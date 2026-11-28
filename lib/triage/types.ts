import type {
  Actor,
  BlockedBy,
  BoardColumn,
  Confidence,
  Effort,
  Impact,
  ItemKind,
  ItemState,
  NextAction,
  Priority,
} from "@/lib/model";

export interface Assessment {
  summary: string;
  nextAction: NextAction;
  effort: Effort;
  impact: Impact;
  unblocksOthers: boolean;
  blockedBy: BlockedBy | null;
  whyNow: string | null;
  confidence: Confidence;
  assessedBy: "claude" | "admin";
  itemUpdatedAt: string;
  assessedAt: string;
}

export interface ItemSummary {
  ref: string;
  repo: string;
  number: number;
  kind: ItemKind;
  title: string;
  state: ItemState;
  author: string;
  authorRole: string;
  column: BoardColumn;
  priority: Priority | null;
  lastReason: string | null;
  seenAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastCommentBy: string | null;
  lastCommentAt: string | null;
  lastCommentIsMaintainer: boolean;
  isDraft: boolean;
  reviewDecision: string | null;
  requestedReviewers: string[];
  labels: string[];
  htmlUrl: string;
  hasDraft: boolean;
  unansweredOwnerMention: boolean;
  unansweredMaintainerMention: boolean;
  assessment: Assessment | null;
  needsAssessment: boolean;
}

export interface ThreadEntry {
  author: string;
  authorRole: string;
  kind: string;
  reviewState: string | null;
  body: string;
  createdAt: string;
}

export interface ItemDetail extends ItemSummary {
  body: string;
  thread: ThreadEntry[];
  notes: { id: number; author: string; kind: string; body: string; createdAt: string }[];
  draft: { id: number; body: string; status: string; updatedAt: string } | null;
  activity: { actor: Actor; action: string; detail: Record<string, unknown>; createdAt: string }[];
}

export interface ColumnChange {
  ref: string;
  title: string;
  from: string | null;
  to: string;
  reason: string | null;
  actor: Actor;
  at: string;
}

export interface BriefingSection {
  total: number;
  items: ItemSummary[];
}

export interface Briefing {
  since: string;
  owner: string;
  lastSyncAt: string | null;
  columnCounts: Partial<Record<BoardColumn, number>>;
  newItems: BriefingSection;
  needsReply: BriefingSection;
  reviewRequested: BriefingSection;
  unansweredMentions: BriefingSection;
  approvedNotMerged: BriefingSection;
  columnChanges: ColumnChange[];
}

export interface ListFilters {
  repo?: string;
  kind?: ItemKind;
  column?: BoardColumn;
  priority?: Priority;
  needsReply?: boolean;
  mentionsMe?: boolean;
  reviewRequested?: boolean;
  limit?: number;
}
