export const COLUMNS = [
  "inbox",
  "needs_reply",
  "needs_review",
  "investigating",
  "waiting",
  "ready",
  "done",
] as const;
export type BoardColumn = (typeof COLUMNS)[number];

export type ItemKind = "issue" | "pr";
export type ItemState = "open" | "closed" | "merged";
export type Priority = "p0" | "p1" | "p2" | "p3";
export type CommentKind = "comment" | "review" | "review_comment";
export type Actor = "claude" | "admin" | "sync";
export type SyncTrigger = "mcp" | "dashboard";
export type SyncStatus = "running" | "partial" | "done" | "failed";

/** Ordered sync phases for one repo. Backfill runs all four; incremental runs the last of each kind. */
export type SyncPhase = "issues-open" | "issues-since" | "prs-open" | "prs-recent";

/** Persisted position of an in-progress repo sync, so a time-budgeted step can resume. */
export interface RepoSyncState {
  backfill: boolean;
  phase: SyncPhase;
  /** GraphQL endCursor for the current phase; null = first page. */
  after: string | null;
  /** ISO lower bound: now-90d during backfill, else the repo's sync cursor. Null = unbounded. */
  since: string | null;
  /** Newest updatedAt seen so far in this repo sync (ISO). */
  maxUpdatedAt: string | null;
}

export interface Label {
  name: string;
  color: string;
}

const MAINTAINER_ROLES: ReadonlySet<string> = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);

export function isMaintainerRole(role: string): boolean {
  return MAINTAINER_ROLES.has(role);
}
