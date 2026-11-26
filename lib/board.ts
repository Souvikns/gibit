import { COLUMNS, type BoardColumn, type ItemKind, type Priority } from "@/lib/model";
import type { ItemSummary } from "@/lib/triage/types";

export const COLUMN_LABELS: Record<BoardColumn, string> = {
  inbox: "Inbox",
  needs_reply: "Needs my reply",
  needs_review: "Needs my review",
  investigating: "Investigating",
  waiting: "Waiting on others",
  ready: "Ready to close/merge",
  done: "Done",
};

export interface BoardFilters {
  repo?: string;
  kind?: ItemKind;
  priority?: Priority;
}

const PRIORITY_RANK: Record<Priority, number> = { p0: 0, p1: 1, p2: 2, p3: 3 };

export function isUnseen(item: ItemSummary): boolean {
  return !item.seenAt || item.updatedAt > item.seenAt;
}

export function filterBoard(items: ItemSummary[], filters: BoardFilters): ItemSummary[] {
  return items.filter(
    (i) =>
      (!filters.repo || i.repo === filters.repo) &&
      (!filters.kind || i.kind === filters.kind) &&
      (!filters.priority || i.priority === filters.priority),
  );
}

export function groupByColumn(items: ItemSummary[]): Record<BoardColumn, ItemSummary[]> {
  const groups = Object.fromEntries(COLUMNS.map((c) => [c, [] as ItemSummary[]])) as Record<BoardColumn, ItemSummary[]>;
  for (const item of items) groups[item.column].push(item);
  for (const column of COLUMNS) {
    groups[column].sort(
      (a, b) =>
        (a.priority ? PRIORITY_RANK[a.priority] : 4) - (b.priority ? PRIORITY_RANK[b.priority] : 4) ||
        b.updatedAt.localeCompare(a.updatedAt),
    );
  }
  return groups;
}

export function deriveRepoOptions(items: ItemSummary[]): string[] {
  return [...new Set(items.map((i) => i.repo))].sort();
}
