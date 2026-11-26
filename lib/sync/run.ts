import { and, desc, eq, inArray, lt, or } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { repos, syncRuns, type SyncCounts, type SyncRepoError } from "@/lib/db/schema";
import { GitHubError } from "@/lib/github/graphql";
import { getOwnerLogin } from "@/lib/github/owner";
import type { SyncStatus, SyncTrigger } from "@/lib/model";
import { fetchPage } from "./fetch-page";
import { advanceRepoState, initialRepoState } from "./plan";
import { storePage } from "./store";

const DEFAULT_BUDGET_MS = 45_000;
/** A "running" step with an older heartbeat is considered dead and may be taken over. */
const STALE_MS = 2 * 60_000;
const MIN_RATE_REMAINING = 200;

export interface SyncProgress {
  runId: number;
  status: SyncStatus;
  reposDone: number;
  reposTotal: number;
  counts: SyncCounts;
  errors: SyncRepoError[];
  rateLimitResetAt: string | null;
  message: string;
}

type Run = typeof syncRuns.$inferSelect;

function progress(run: Run, message: string): SyncProgress {
  return {
    runId: run.id,
    status: run.status,
    reposDone: run.doneRepoIds.length,
    reposTotal: run.repoIds.length,
    counts: run.counts,
    errors: run.errors,
    rateLimitResetAt: run.rateLimitResetAt?.toISOString() ?? null,
    message,
  };
}

export async function getLatestSync(): Promise<SyncProgress | null> {
  const [run] = await db().select().from(syncRuns).orderBy(desc(syncRuns.id)).limit(1);
  return run ? progress(run, "") : null;
}

async function findActiveRun(): Promise<Run | undefined> {
  const [run] = await db()
    .select()
    .from(syncRuns)
    .where(inArray(syncRuns.status, ["running", "partial"]))
    .orderBy(desc(syncRuns.id))
    .limit(1);
  return run;
}

/** Atomically claim a partial or stale run for this step. Returns null if another step holds it. */
async function claim(runId: number, now: Date): Promise<Run | null> {
  const [run] = await db()
    .update(syncRuns)
    .set({ status: "running", heartbeatAt: now })
    .where(
      and(
        eq(syncRuns.id, runId),
        or(eq(syncRuns.status, "partial"), lt(syncRuns.heartbeatAt, new Date(now.getTime() - STALE_MS))),
      ),
    )
    .returning();
  return run ?? null;
}

async function startRun(trigger: SyncTrigger, repoIds: number[] | undefined, now: Date): Promise<Run | SyncProgress> {
  const enabled = await db().select({ id: repos.id }).from(repos).where(eq(repos.enabled, true));
  const ids = enabled.map((r) => r.id).filter((id) => !repoIds || repoIds.includes(id));
  if (ids.length === 0) {
    const [empty] = await db()
      .insert(syncRuns)
      .values({ trigger, status: "done", repoIds: [], finishedAt: now })
      .returning();
    return progress(empty!, "No enabled repos to sync. Add repos in Settings.");
  }
  const [created] = await db().insert(syncRuns).values({ trigger, status: "running", repoIds: ids }).returning();
  return created!;
}

export async function syncStep(opts: {
  trigger: SyncTrigger;
  repoIds?: number[];
  budgetMs?: number;
}): Promise<SyncProgress> {
  const startedAt = Date.now();
  const budget = opts.budgetMs ?? DEFAULT_BUDGET_MS;
  const now = new Date(startedAt);

  let run: Run;
  const active = await findActiveRun();
  if (active) {
    if (active.rateLimitResetAt && active.rateLimitResetAt.getTime() > startedAt) {
      return progress(active, `Rate limited until ${active.rateLimitResetAt.toISOString()}. Call again after that.`);
    }
    const claimed = await claim(active.id, now);
    if (!claimed) return progress(active, "A sync step is already running. Call again shortly.");
    run = claimed;
  } else {
    const started = await startRun(opts.trigger, opts.repoIds, now);
    if ("message" in started) return started;
    run = started;
  }

  const ownerLogin = await getOwnerLogin();
  const counts: SyncCounts = { ...run.counts };
  const errors: SyncRepoError[] = [...run.errors];
  const done = new Set(run.doneRepoIds);
  let rateLimitResetAt: Date | null = null;

  const remainingIds = run.repoIds.filter((id) => !done.has(id));
  const pending =
    remainingIds.length > 0 ? await db().select().from(repos).where(inArray(repos.id, remainingIds)) : [];

  outer: for (const repo of pending) {
    let state = repo.syncState ?? initialRepoState(repo, Date.now());
    const label = `${repo.owner}/${repo.name}`;
    try {
      while (true) {
        if (Date.now() - startedAt > budget) {
          await db().update(repos).set({ syncState: state }).where(eq(repos.id, repo.id));
          break outer;
        }
        const page = await fetchPage(repo, state, ownerLogin);
        const stored = await storePage(page.mapped);
        counts.items += stored.items;
        counts.comments += stored.comments;

        const next = advanceRepoState(state, page);
        if (next === "done") {
          const cursorIso =
            page.maxUpdatedAt && (!state.maxUpdatedAt || page.maxUpdatedAt > state.maxUpdatedAt)
              ? page.maxUpdatedAt
              : state.maxUpdatedAt;
          await db()
            .update(repos)
            .set({
              syncCursor: cursorIso ? new Date(cursorIso) : repo.syncCursor,
              backfilledAt: repo.backfilledAt ?? new Date(),
              syncState: null,
              lastSyncedAt: new Date(),
              lastError: null,
              ...(page.defaultBranch ? { defaultBranch: page.defaultBranch } : {}),
            })
            .where(eq(repos.id, repo.id));
          done.add(repo.id);
          break;
        }
        state = next;
        await db().update(repos).set({ syncState: state }).where(eq(repos.id, repo.id));
        await db().update(syncRuns).set({ heartbeatAt: new Date(), counts }).where(eq(syncRuns.id, run.id));

        if (page.rateLimit.remaining < MIN_RATE_REMAINING) {
          rateLimitResetAt = new Date(page.rateLimit.resetAt);
          break outer;
        }
      }
    } catch (error) {
      if (error instanceof GitHubError && error.kind === "rate-limited") {
        await db().update(repos).set({ syncState: state }).where(eq(repos.id, repo.id));
        rateLimitResetAt = new Date(error.resetAt ?? Date.now() + 60 * 60_000);
        break;
      }
      const message = error instanceof Error ? error.message : String(error);
      errors.push({ repo: label, message });
      await db().update(repos).set({ lastError: message, syncState: null }).where(eq(repos.id, repo.id));
      done.add(repo.id);
    }
  }

  const finished = run.repoIds.every((id) => done.has(id));
  const [saved] = await db()
    .update(syncRuns)
    .set({
      status: finished ? "done" : "partial",
      doneRepoIds: [...done],
      counts,
      errors,
      rateLimitResetAt,
      heartbeatAt: new Date(),
      finishedAt: finished ? new Date() : null,
    })
    .where(eq(syncRuns.id, run.id))
    .returning();

  const message = finished
    ? `Sync complete: ${counts.items} items, ${counts.comments} comments${errors.length ? `, ${errors.length} repo error(s)` : ""}.`
    : rateLimitResetAt
      ? `Paused for GitHub rate limit until ${rateLimitResetAt.toISOString()}.`
      : `Partial: ${done.size}/${run.repoIds.length} repos done. Call sync again to continue.`;
  return progress(saved!, message);
}
