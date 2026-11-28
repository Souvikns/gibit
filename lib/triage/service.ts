import { and, asc, desc, eq, gt, inArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  activityLog,
  appState,
  assessments,
  comments,
  drafts,
  items,
  mentions,
  notes,
  reports,
  repos,
  syncRuns,
  triage,
} from "@/lib/db/schema";
import { excludedSet } from "@/lib/db/upsert";
import { getOwnerLogin } from "@/lib/github/owner";
import { parseRepoFullName } from "@/lib/github/names";
import {
  COLUMNS,
  type Actor,
  type BlockedBy,
  type BoardColumn,
  type Confidence,
  type Effort,
  type Impact,
  type NextAction,
  type Priority,
} from "@/lib/model";
import { needsAssessment } from "@/lib/focus";
import { selectBriefing } from "./briefing";
import { formatRef, parseRef } from "./refs";
import { isReviewRequested, needsReply } from "./signals";
import type { Assessment, Briefing, ColumnChange, ItemDetail, ItemSummary, ListFilters } from "./types";

export class TriageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TriageError";
  }
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const DAY_MS = 86_400_000;
const BOARD_DONE_DAYS = 14;

// ---------- Summaries ----------

const summaryColumns = {
  id: items.id,
  owner: repos.owner,
  name: repos.name,
  number: items.number,
  kind: items.kind,
  title: items.title,
  state: items.state,
  author: items.author,
  authorRole: items.authorRole,
  column: triage.column,
  priority: triage.priority,
  lastReason: triage.lastReason,
  seenAt: triage.seenAt,
  createdAt: items.createdAt,
  updatedAt: items.updatedAt,
  lastCommentBy: items.lastCommentBy,
  lastCommentAt: items.lastCommentAt,
  lastCommentIsMaintainer: items.lastCommentIsMaintainer,
  isDraft: items.isDraft,
  reviewDecision: items.reviewDecision,
  requestedReviewers: items.requestedReviewers,
  labels: items.labels,
  htmlUrl: items.htmlUrl,
  aSummary: assessments.summary,
  aNextAction: assessments.nextAction,
  aEffort: assessments.effort,
  aImpact: assessments.impact,
  aUnblocksOthers: assessments.unblocksOthers,
  aBlockedBy: assessments.blockedBy,
  aWhyNow: assessments.whyNow,
  aConfidence: assessments.confidence,
  aAssessedBy: assessments.assessedBy,
  aItemUpdatedAt: assessments.itemUpdatedAt,
  aAssessedAt: assessments.assessedAt,
};

interface Flags {
  draftItemIds: Set<string>;
  ownerMentionIds: Set<string>;
  maintainerMentionIds: Set<string>;
}

async function loadFlags(): Promise<Flags> {
  const [draftRows, mentionRows] = await Promise.all([
    db().select({ itemId: drafts.itemId }).from(drafts).where(eq(drafts.status, "draft")),
    db()
      .select({ itemId: mentions.itemId, isOwner: mentions.isOwner })
      .from(mentions)
      .where(eq(mentions.answered, false)),
  ]);
  return {
    draftItemIds: new Set(draftRows.map((r) => r.itemId)),
    ownerMentionIds: new Set(mentionRows.filter((m) => m.isOwner).map((m) => m.itemId)),
    maintainerMentionIds: new Set(mentionRows.filter((m) => !m.isOwner).map((m) => m.itemId)),
  };
}

function toAssessment(row: SummaryRow): Assessment | null {
  if (
    row.aSummary === null ||
    !row.aNextAction ||
    !row.aEffort ||
    !row.aImpact ||
    !row.aConfidence ||
    !row.aAssessedBy ||
    !row.aItemUpdatedAt ||
    !row.aAssessedAt
  ) {
    return null;
  }
  return {
    summary: row.aSummary,
    nextAction: row.aNextAction,
    effort: row.aEffort,
    impact: row.aImpact,
    unblocksOthers: row.aUnblocksOthers ?? false,
    blockedBy: row.aBlockedBy ?? null,
    whyNow: row.aWhyNow ?? null,
    confidence: row.aConfidence,
    assessedBy: row.aAssessedBy,
    itemUpdatedAt: row.aItemUpdatedAt.toISOString(),
    assessedAt: row.aAssessedAt.toISOString(),
  };
}

function toSummary(row: SummaryRow, flags: Flags): ItemSummary {
  const assessment = toAssessment(row);
  const updatedAt = row.updatedAt.toISOString();
  return {
    ref: formatRef(row.owner, row.name, row.number),
    repo: `${row.owner}/${row.name}`,
    number: row.number,
    kind: row.kind,
    title: row.title,
    state: row.state,
    author: row.author,
    authorRole: row.authorRole,
    column: row.column ?? "inbox",
    priority: row.priority ?? null,
    lastReason: row.lastReason ?? null,
    seenAt: row.seenAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lastCommentBy: row.lastCommentBy,
    lastCommentAt: row.lastCommentAt?.toISOString() ?? null,
    lastCommentIsMaintainer: row.lastCommentIsMaintainer,
    isDraft: row.isDraft,
    reviewDecision: row.reviewDecision,
    requestedReviewers: row.requestedReviewers,
    labels: row.labels.map((l) => l.name),
    htmlUrl: row.htmlUrl,
    hasDraft: flags.draftItemIds.has(row.id),
    unansweredOwnerMention: flags.ownerMentionIds.has(row.id),
    unansweredMaintainerMention: flags.maintainerMentionIds.has(row.id),
    assessment,
    needsAssessment: needsAssessment({ updatedAt }, assessment),
  };
}

function querySummaryRows(where?: SQL) {
  return db()
    .select(summaryColumns)
    .from(items)
    .innerJoin(repos, eq(repos.id, items.repoId))
    .leftJoin(triage, eq(triage.itemId, items.id))
    .leftJoin(assessments, eq(assessments.itemId, items.id))
    .where(where)
    .orderBy(desc(items.updatedAt));
}

type SummaryRow = Awaited<ReturnType<typeof querySummaryRows>>[number];

async function selectSummaries(where?: SQL): Promise<ItemSummary[]> {
  const [rows, flags] = await Promise.all([querySummaryRows(where), loadFlags()]);
  return rows.map((row) => toSummary(row, flags));
}

// ---------- Refs ----------

async function resolveRef(ref: string): Promise<{ itemId: string; ref: string }> {
  const parsed = parseRef(ref);
  if (!parsed) throw new TriageError(`Invalid ref "${ref}", expected owner/repo#number`);
  const [row] = await db()
    .select({ id: items.id, owner: repos.owner, name: repos.name })
    .from(items)
    .innerJoin(repos, eq(repos.id, items.repoId))
    .where(
      and(
        sql`lower(${repos.owner}) = ${parsed.owner.toLowerCase()}`,
        sql`lower(${repos.name}) = ${parsed.name.toLowerCase()}`,
        eq(items.number, parsed.number),
      ),
    );
  if (!row) throw new TriageError(`Unknown item ${ref} — run sync or check the ref`);
  return { itemId: row.id, ref: formatRef(row.owner, row.name, parsed.number) };
}

async function summaryById(itemId: string): Promise<ItemSummary> {
  const [summary] = await selectSummaries(eq(items.id, itemId));
  if (!summary) throw new TriageError(`Item ${itemId} disappeared`);
  return summary;
}

async function log(
  itemId: string | null,
  actor: Actor,
  action: "move" | "note" | "draft" | "report" | "assess",
  detail: Record<string, unknown>,
) {
  await db().insert(activityLog).values({ itemId, actor, action, detail });
}

// ---------- Reads ----------

export async function listRepoSummaries() {
  const rows = await db().select().from(repos).orderBy(asc(repos.owner), asc(repos.name));
  return rows.map((r) => ({
    repo: `${r.owner}/${r.name}`,
    cloneUrl: `https://github.com/${r.owner}/${r.name}.git`,
    defaultBranch: r.defaultBranch,
    enabled: r.enabled,
    lastSyncedAt: r.lastSyncedAt?.toISOString() ?? null,
    lastError: r.lastError,
  }));
}

export async function listItems(filters: ListFilters): Promise<{ total: number; items: ItemSummary[] }> {
  const conditions: SQL[] = [];
  if (filters.repo) {
    const parsed = parseRepoFullName(filters.repo);
    if (!parsed) throw new TriageError(`Invalid repo "${filters.repo}", expected owner/name`);
    conditions.push(sql`lower(${repos.owner}) = ${parsed.owner.toLowerCase()}`);
    conditions.push(sql`lower(${repos.name}) = ${parsed.name.toLowerCase()}`);
  }
  if (filters.kind) conditions.push(eq(items.kind, filters.kind));
  if (filters.column) {
    conditions.push(
      filters.column === "inbox"
        ? sql`coalesce(${triage.column}, 'inbox') = 'inbox'`
        : eq(triage.column, filters.column),
    );
  }
  if (filters.priority) conditions.push(eq(triage.priority, filters.priority));

  let result = await selectSummaries(conditions.length ? and(...conditions) : undefined);
  if (filters.needsReply || filters.reviewRequested) {
    const owner = await getOwnerLogin();
    if (filters.needsReply) result = result.filter((s) => needsReply(s, owner));
    if (filters.reviewRequested) result = result.filter((s) => isReviewRequested(s, owner));
  }
  if (filters.mentionsMe) result = result.filter((s) => s.state === "open" && s.unansweredOwnerMention);
  if (filters.needsAssessment) result = result.filter((s) => s.state === "open" && s.needsAssessment);

  const limit = Math.min(Math.max(filters.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  return { total: result.length, items: result.slice(0, limit) };
}

export async function getItem(ref: string): Promise<ItemDetail> {
  const { itemId } = await resolveRef(ref);
  const [summary, [base], thread, noteRows, [draft], activity] = await Promise.all([
    summaryById(itemId),
    db().select({ body: items.body }).from(items).where(eq(items.id, itemId)),
    db().select().from(comments).where(eq(comments.itemId, itemId)).orderBy(asc(comments.createdAt)),
    db().select().from(notes).where(eq(notes.itemId, itemId)).orderBy(asc(notes.createdAt)),
    db()
      .select()
      .from(drafts)
      .where(and(eq(drafts.itemId, itemId), eq(drafts.status, "draft")))
      .orderBy(desc(drafts.updatedAt))
      .limit(1),
    db().select().from(activityLog).where(eq(activityLog.itemId, itemId)).orderBy(desc(activityLog.createdAt)).limit(50),
  ]);
  return {
    ...summary,
    body: base?.body ?? "",
    thread: thread.map((c) => ({
      author: c.author,
      authorRole: c.authorRole,
      kind: c.kind,
      reviewState: c.reviewState,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
    })),
    notes: noteRows.map((n) => ({ id: n.id, author: n.author, kind: n.kind, body: n.body, createdAt: n.createdAt.toISOString() })),
    draft: draft ? { id: draft.id, body: draft.body, status: draft.status, updatedAt: draft.updatedAt.toISOString() } : null,
    activity: activity.map((a) => ({ actor: a.actor, action: a.action, detail: a.detail, createdAt: a.createdAt.toISOString() })),
  };
}

export async function listReports(limit = 10) {
  const rows = await db()
    .select()
    .from(reports)
    .orderBy(desc(reports.createdAt))
    .limit(Math.min(Math.max(limit, 1), 50));
  return rows.map((r) => ({ id: r.id, title: r.title, body: r.body, createdAt: r.createdAt.toISOString() }));
}

export async function getBriefing(since?: string): Promise<Briefing> {
  let sinceDate: Date;
  if (since) {
    sinceDate = new Date(since);
    if (Number.isNaN(sinceDate.getTime())) throw new TriageError(`Invalid since "${since}", expected an ISO date`);
  } else {
    const [row] = await db().select().from(appState).where(eq(appState.key, "last_briefing_at"));
    sinceDate = row ? new Date(row.value) : new Date(Date.now() - DAY_MS);
  }

  const [owner, summaries, changeRows, [lastRun]] = await Promise.all([
    getOwnerLogin(),
    selectSummaries(),
    db()
      .select({
        detail: activityLog.detail,
        actor: activityLog.actor,
        createdAt: activityLog.createdAt,
        number: items.number,
        title: items.title,
        owner: repos.owner,
        name: repos.name,
      })
      .from(activityLog)
      .innerJoin(items, eq(items.id, activityLog.itemId))
      .innerJoin(repos, eq(repos.id, items.repoId))
      .where(and(eq(activityLog.action, "move"), gt(activityLog.createdAt, sinceDate), sql`${activityLog.actor} <> 'sync'`))
      .orderBy(desc(activityLog.createdAt))
      .limit(100),
    db().select().from(syncRuns).where(eq(syncRuns.status, "done")).orderBy(desc(syncRuns.id)).limit(1),
  ]);

  const changes: ColumnChange[] = changeRows.map((c) => ({
    ref: formatRef(c.owner, c.name, c.number),
    title: c.title,
    from: (c.detail.from as string | null) ?? null,
    to: String(c.detail.to),
    reason: (c.detail.reason as string | null) ?? null,
    actor: c.actor,
    at: c.createdAt.toISOString(),
  }));

  const briefing = selectBriefing({
    items: summaries,
    changes,
    since: sinceDate,
    owner,
    lastSyncAt: lastRun?.finishedAt?.toISOString() ?? null,
  });

  const now = new Date().toISOString();
  await db()
    .insert(appState)
    .values({ key: "last_briefing_at", value: now })
    .onConflictDoUpdate({ target: appState.key, set: { value: now } });
  return briefing;
}

/** Everything not done, plus items that reached done recently. */
export async function boardItems(): Promise<ItemSummary[]> {
  const cutoff = new Date(Date.now() - BOARD_DONE_DAYS * DAY_MS);
  return selectSummaries(
    or(sql`coalesce(${triage.column}, 'inbox') <> 'done'`, gt(items.updatedAt, cutoff)),
  );
}

// ---------- Writes ----------

/** Owner opened the item: clears the unseen-activity badge. Owner-only; never exposed over MCP. */
export async function markSeen(ref: string): Promise<void> {
  const { itemId } = await resolveRef(ref);
  const now = new Date();
  await db()
    .insert(triage)
    .values({ itemId, column: "inbox", seenAt: now, updatedAt: now })
    .onConflictDoUpdate({ target: triage.itemId, set: { seenAt: now } });
}

export async function markDraftCopied(ref: string): Promise<void> {
  const { itemId } = await resolveRef(ref);
  const [updated] = await db()
    .update(drafts)
    .set({ status: "copied", updatedAt: new Date() })
    .where(and(eq(drafts.itemId, itemId), eq(drafts.status, "draft")))
    .returning({ id: drafts.id });
  if (updated) await log(itemId, "admin", "draft", { draftId: updated.id, status: "copied" });
}

export async function moveItem(input: {
  ref: string;
  column: BoardColumn;
  reason: string;
  priority?: Priority | null;
  actor: Actor;
}): Promise<ItemSummary> {
  if (!COLUMNS.includes(input.column)) throw new TriageError(`Unknown column "${input.column}"`);
  const reason = input.reason.trim();
  if (!reason) throw new TriageError("A reason is required when moving an item");
  const { itemId } = await resolveRef(input.ref);
  const [current] = await db().select().from(triage).where(eq(triage.itemId, itemId));
  const now = new Date();
  const priority = input.priority === undefined ? (current?.priority ?? null) : input.priority;

  await db()
    .insert(triage)
    .values({ itemId, column: input.column, priority, lastReason: reason, updatedAt: now })
    .onConflictDoUpdate({
      target: triage.itemId,
      set: { column: input.column, priority, lastReason: reason, updatedAt: now },
    });
  await log(itemId, input.actor, "move", {
    from: current?.column ?? null,
    to: input.column,
    reason,
    ...(input.priority !== undefined ? { priority } : {}),
  });
  return summaryById(itemId);
}

export async function addNote(input: {
  ref: string;
  body: string;
  kind: "research" | "note";
  author: "claude" | "admin";
}): Promise<{ id: number }> {
  if (!input.body.trim()) throw new TriageError("Note body is empty");
  const { itemId } = await resolveRef(input.ref);
  const [row] = await db()
    .insert(notes)
    .values({ itemId, author: input.author, kind: input.kind, body: input.body })
    .returning({ id: notes.id });
  await log(itemId, input.author, "note", { kind: input.kind, noteId: row!.id });
  return { id: row!.id };
}

export async function saveDraft(input: { ref: string; body: string; author: "claude" | "admin" }): Promise<{ id: number }> {
  if (!input.body.trim()) throw new TriageError("Draft body is empty");
  const { itemId } = await resolveRef(input.ref);
  const now = new Date();
  await db()
    .update(drafts)
    .set({ status: "discarded", updatedAt: now })
    .where(and(eq(drafts.itemId, itemId), eq(drafts.status, "draft")));
  const [row] = await db()
    .insert(drafts)
    .values({ itemId, body: input.body, createdBy: input.author, updatedAt: now })
    .returning({ id: drafts.id });
  await log(itemId, input.author, "draft", { draftId: row!.id });
  return { id: row!.id };
}

export async function saveReport(input: { title: string; body: string }): Promise<{ id: number; createdAt: string }> {
  if (!input.title.trim() || !input.body.trim()) throw new TriageError("Report title and body are required");
  const [row] = await db()
    .insert(reports)
    .values({ title: input.title.trim(), body: input.body })
    .returning({ id: reports.id, createdAt: reports.createdAt });
  await log(null, "claude", "report", { reportId: row!.id, title: input.title.trim() });
  return { id: row!.id, createdAt: row!.createdAt.toISOString() };
}

// ---------- Assessments ----------

export const MAX_ASSESS_BATCH = 25;
export const MAX_SUMMARY_LENGTH = 200;

export interface AssessmentInput {
  ref: string;
  summary: string;
  nextAction: NextAction;
  effort: Effort;
  impact: Impact;
  unblocksOthers?: boolean;
  blockedBy?: BlockedBy | null;
  whyNow?: string | null;
  confidence: Confidence;
}

/** Open items with their assessments, for the Focus page. */
export async function focusItems(): Promise<ItemSummary[]> {
  return selectSummaries(eq(items.state, "open"));
}

/** All-or-nothing: every ref must resolve before anything is written. */
export async function assessItems(
  entries: AssessmentInput[],
  actor: "claude" | "admin",
): Promise<{ assessed: string[] }> {
  if (entries.length === 0) throw new TriageError("No assessments given");
  if (entries.length > MAX_ASSESS_BATCH) throw new TriageError(`At most ${MAX_ASSESS_BATCH} assessments per call`);

  const resolved: { itemId: string; ref: string; entry: AssessmentInput }[] = [];
  const failures: string[] = [];
  for (const entry of entries) {
    const summary = entry.summary.trim();
    if (!summary) failures.push(`${entry.ref}: summary is empty`);
    else if (summary.length > MAX_SUMMARY_LENGTH) failures.push(`${entry.ref}: summary over ${MAX_SUMMARY_LENGTH} chars`);
    try {
      const { itemId, ref } = await resolveRef(entry.ref);
      resolved.push({ itemId, ref, entry });
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }
  if (failures.length) throw new TriageError(`Nothing saved. Fix these and retry:\n- ${failures.join("\n- ")}`);

  const updatedAt = new Map(
    (
      await db()
        .select({ id: items.id, updatedAt: items.updatedAt })
        .from(items)
        .where(inArray(items.id, resolved.map((r) => r.itemId)))
    ).map((r) => [r.id, r.updatedAt]),
  );
  const now = new Date();
  const rows = resolved.map(({ itemId, entry }) => ({
    itemId,
    summary: entry.summary.trim(),
    nextAction: entry.nextAction,
    effort: entry.effort,
    impact: entry.impact,
    unblocksOthers: entry.unblocksOthers ?? false,
    blockedBy: entry.blockedBy ?? null,
    whyNow: entry.whyNow?.trim() || null,
    confidence: entry.confidence,
    assessedBy: actor,
    itemUpdatedAt: updatedAt.get(itemId) ?? now,
    assessedAt: now,
  }));
  await db()
    .insert(assessments)
    .values(rows)
    .onConflictDoUpdate({ target: assessments.itemId, set: excludedSet(assessments, ["itemId"]) });
  await db()
    .insert(activityLog)
    .values(
      resolved.map(({ itemId, entry }) => ({
        itemId,
        actor,
        action: "assess" as const,
        detail: { nextAction: entry.nextAction, effort: entry.effort, impact: entry.impact },
      })),
    );
  return { assessed: resolved.map((r) => r.ref) };
}

/** Owner correction from the drawer. Creates an assessment if Claude hasn't made one. */
export async function overrideAssessment(
  ref: string,
  patch: { nextAction?: NextAction; effort?: Effort; impact?: Impact },
): Promise<ItemSummary> {
  const { itemId } = await resolveRef(ref);
  const current = await summaryById(itemId);
  const base = current.assessment;
  await assessItems(
    [
      {
        ref,
        summary: base?.summary ?? current.title.slice(0, MAX_SUMMARY_LENGTH),
        nextAction: patch.nextAction ?? base?.nextAction ?? "decide",
        effort: patch.effort ?? base?.effort ?? "m",
        impact: patch.impact ?? base?.impact ?? "med",
        unblocksOthers: base?.unblocksOthers ?? false,
        blockedBy: base?.blockedBy ?? null,
        whyNow: base?.whyNow ?? null,
        confidence: "high",
      },
    ],
    "admin",
  );
  return summaryById(itemId);
}
