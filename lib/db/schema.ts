import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type {
  Actor,
  BlockedBy,
  BoardColumn,
  Confidence,
  Effort,
  Impact,
  NextAction,
  CommentKind,
  ItemKind,
  ItemState,
  Label,
  Priority,
  RepoSyncState,
  SyncStatus,
  SyncTrigger,
} from "@/lib/model";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

// ---------- Mirror (written only by sync) ----------

export const repos = pgTable(
  "repos",
  {
    id: serial("id").primaryKey(),
    owner: text("owner").notNull(),
    name: text("name").notNull(),
    private: boolean("private").notNull().default(false),
    defaultBranch: text("default_branch").notNull().default("main"),
    enabled: boolean("enabled").notNull().default(true),
    syncCursor: ts("sync_cursor"),
    backfilledAt: ts("backfilled_at"),
    syncState: jsonb("sync_state").$type<RepoSyncState | null>(),
    lastSyncedAt: ts("last_synced_at"),
    lastError: text("last_error"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("repos_owner_name").on(t.owner, t.name)],
);

export const items = pgTable(
  "items",
  {
    id: text("id").primaryKey(), // GitHub node id
    repoId: integer("repo_id")
      .notNull()
      .references(() => repos.id, { onDelete: "cascade" }),
    kind: text("kind").$type<ItemKind>().notNull(),
    number: integer("number").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    state: text("state").$type<ItemState>().notNull(),
    author: text("author").notNull(),
    authorRole: text("author_role").notNull(),
    labels: jsonb("labels").$type<Label[]>().notNull().default([]),
    commentsCount: integer("comments_count").notNull().default(0),
    reactionsCount: integer("reactions_count").notNull().default(0),
    createdAt: ts("created_at").notNull(),
    updatedAt: ts("updated_at").notNull(),
    closedAt: ts("closed_at"),
    mergedAt: ts("merged_at"),
    htmlUrl: text("html_url").notNull(),
    lastCommentBy: text("last_comment_by"),
    lastCommentAt: ts("last_comment_at"),
    lastCommentIsMaintainer: boolean("last_comment_is_maintainer").notNull().default(false),
    isDraft: boolean("is_draft").notNull().default(false),
    reviewDecision: text("review_decision"),
    requestedReviewers: jsonb("requested_reviewers").$type<string[]>().notNull().default([]),
  },
  (t) => [
    uniqueIndex("items_repo_number").on(t.repoId, t.number),
    index("items_updated_at").on(t.updatedAt),
  ],
);

export const comments = pgTable(
  "comments",
  {
    id: text("id").primaryKey(), // GitHub node id
    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    author: text("author").notNull(),
    authorRole: text("author_role").notNull(),
    kind: text("kind").$type<CommentKind>().notNull(),
    reviewState: text("review_state"),
    body: text("body").notNull().default(""),
    createdAt: ts("created_at").notNull(),
  },
  (t) => [index("comments_item_id").on(t.itemId)],
);

export const mentions = pgTable(
  "mentions",
  {
    id: serial("id").primaryKey(),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    commentId: text("comment_id"), // null = item body
    login: text("login").notNull(),
    isOwner: boolean("is_owner").notNull(),
    isMaintainer: boolean("is_maintainer").notNull(),
    answered: boolean("answered").notNull(),
    createdAt: ts("created_at").notNull(),
  },
  (t) => [index("mentions_item_id").on(t.itemId)],
);

// ---------- Overlay (written by owner and Claude) ----------

export const triage = pgTable("triage", {
  itemId: text("item_id")
    .primaryKey()
    .references(() => items.id, { onDelete: "cascade" }),
  column: text("column").$type<BoardColumn>().notNull(),
  priority: text("priority").$type<Priority>(),
  lastReason: text("last_reason"),
  seenAt: ts("seen_at"),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const assessments = pgTable("assessments", {
  itemId: text("item_id")
    .primaryKey()
    .references(() => items.id, { onDelete: "cascade" }),
  summary: text("summary").notNull(),
  nextAction: text("next_action").$type<NextAction>().notNull(),
  effort: text("effort").$type<Effort>().notNull(),
  impact: text("impact").$type<Impact>().notNull(),
  unblocksOthers: boolean("unblocks_others").notNull().default(false),
  blockedBy: jsonb("blocked_by").$type<BlockedBy | null>(),
  whyNow: text("why_now"),
  confidence: text("confidence").$type<Confidence>().notNull(),
  assessedBy: text("assessed_by").$type<"claude" | "admin">().notNull(),
  itemUpdatedAt: ts("item_updated_at").notNull(),
  assessedAt: ts("assessed_at").notNull().defaultNow(),
});

export const notes = pgTable("notes", {
  id: serial("id").primaryKey(),
  itemId: text("item_id")
    .notNull()
    .references(() => items.id, { onDelete: "cascade" }),
  author: text("author").$type<"claude" | "admin">().notNull(),
  kind: text("kind").$type<"research" | "note">().notNull(),
  body: text("body").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const drafts = pgTable("drafts", {
  id: serial("id").primaryKey(),
  itemId: text("item_id")
    .notNull()
    .references(() => items.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  status: text("status").$type<"draft" | "copied" | "discarded">().notNull().default("draft"),
  createdBy: text("created_by").$type<"claude" | "admin">().notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const reports = pgTable("reports", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const activityLog = pgTable(
  "activity_log",
  {
    id: serial("id").primaryKey(),
    itemId: text("item_id").references(() => items.id, { onDelete: "cascade" }),
    actor: text("actor").$type<Actor>().notNull(),
    action: text("action").$type<"move" | "note" | "draft" | "report" | "sync" | "assess">().notNull(),
    detail: jsonb("detail").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("activity_log_item_id").on(t.itemId), index("activity_log_created_at").on(t.createdAt)],
);

// ---------- Operational ----------

export interface SyncCounts {
  items: number;
  comments: number;
}

export interface SyncRepoError {
  repo: string;
  message: string;
}

export const syncRuns = pgTable("sync_runs", {
  id: serial("id").primaryKey(),
  trigger: text("trigger").$type<SyncTrigger>().notNull(),
  status: text("status").$type<SyncStatus>().notNull(),
  repoIds: jsonb("repo_ids").$type<number[]>().notNull(),
  doneRepoIds: jsonb("done_repo_ids").$type<number[]>().notNull().default([]),
  counts: jsonb("counts").$type<SyncCounts>().notNull().default({ items: 0, comments: 0 }),
  errors: jsonb("errors").$type<SyncRepoError[]>().notNull().default([]),
  error: text("error"),
  rateLimitResetAt: ts("rate_limit_reset_at"),
  heartbeatAt: ts("heartbeat_at").notNull().defaultNow(),
  startedAt: ts("started_at").notNull().defaultNow(),
  finishedAt: ts("finished_at"),
});

export const appState = pgTable("app_state", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const loginAttempts = pgTable("login_attempts", {
  ip: text("ip").primaryKey(),
  count: integer("count").notNull(),
  windowStart: ts("window_start").notNull(),
});
