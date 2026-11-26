import type { BoardColumn } from "@/lib/model";
import { isReviewRequested, needsReply } from "./signals";
import type { Briefing, BriefingSection, ColumnChange, ItemSummary } from "./types";

export const BRIEFING_SECTION_CAP = 25;

function section(items: ItemSummary[]): BriefingSection {
  const sorted = [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return { total: sorted.length, items: sorted.slice(0, BRIEFING_SECTION_CAP) };
}

export function selectBriefing(input: {
  items: ItemSummary[];
  changes: ColumnChange[];
  since: Date;
  owner: string;
  lastSyncAt: string | null;
}): Briefing {
  const { items, owner } = input;
  const since = input.since.toISOString();
  const columnCounts: Partial<Record<BoardColumn, number>> = {};
  for (const item of items) columnCounts[item.column] = (columnCounts[item.column] ?? 0) + 1;

  return {
    since,
    owner,
    lastSyncAt: input.lastSyncAt,
    columnCounts,
    newItems: section(items.filter((i) => i.createdAt > since)),
    needsReply: section(items.filter((i) => needsReply(i, owner) && i.updatedAt > since)),
    reviewRequested: section(items.filter((i) => isReviewRequested(i, owner))),
    unansweredMentions: section(
      items.filter((i) => i.state === "open" && (i.unansweredOwnerMention || i.unansweredMaintainerMention)),
    ),
    approvedNotMerged: section(
      items.filter((i) => i.kind === "pr" && i.state === "open" && i.reviewDecision === "APPROVED"),
    ),
    columnChanges: [...input.changes].sort((a, b) => b.at.localeCompare(a.at)),
  };
}
