import type { RepoSyncState, SyncPhase } from "@/lib/model";

export const BACKFILL_DAYS = 90;
const DAY_MS = 86_400_000;

const BACKFILL_PHASES: SyncPhase[] = ["issues-open", "issues-since", "prs-open", "prs-recent"];
const INCREMENTAL_PHASES: SyncPhase[] = ["issues-since", "prs-recent"];

export function phaseKind(phase: SyncPhase): "issues" | "prs" {
  return phase.startsWith("issues") ? "issues" : "prs";
}

export function initialRepoState(
  repo: { syncCursor: Date | null; backfilledAt: Date | null },
  now: number,
): RepoSyncState {
  if (!repo.backfilledAt || !repo.syncCursor) {
    return {
      backfill: true,
      phase: "issues-open",
      after: null,
      since: new Date(now - BACKFILL_DAYS * DAY_MS).toISOString(),
      maxUpdatedAt: null,
    };
  }
  const cursor = repo.syncCursor.toISOString();
  return { backfill: false, phase: "issues-since", after: null, since: cursor, maxUpdatedAt: cursor };
}

function maxIso(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

export function advanceRepoState(
  state: RepoSyncState,
  page: { hasNextPage: boolean; endCursor: string | null; reachedSince: boolean; maxUpdatedAt: string | null },
): RepoSyncState | "done" {
  const maxUpdatedAt = maxIso(state.maxUpdatedAt, page.maxUpdatedAt);
  const phaseFinished = !page.hasNextPage || (state.phase === "prs-recent" && page.reachedSince);
  if (!phaseFinished) return { ...state, after: page.endCursor, maxUpdatedAt };

  const phases = state.backfill ? BACKFILL_PHASES : INCREMENTAL_PHASES;
  const next = phases[phases.indexOf(state.phase) + 1];
  if (!next) return "done";
  return { ...state, phase: next, after: null, maxUpdatedAt };
}
