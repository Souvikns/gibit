"use client";

import { useDraggable } from "@dnd-kit/core";
import { IssueClosedIcon, IssueOpenIcon, MergedIcon, PullRequestIcon } from "@/components/icons";
import { COLUMN_LABELS, isUnseen } from "@/lib/board";
import { COLUMNS, type BoardColumn, type Priority } from "@/lib/model";
import { isReviewRequested } from "@/lib/triage/signals";
import type { ItemSummary } from "@/lib/triage/types";
import { relativeTime } from "@/lib/time";

export const PRIORITY_CLASS: Record<Priority, string> = {
  p0: "bg-card-tint-rose text-semantic-error",
  p1: "bg-card-tint-peach text-brand-orange-deep",
  p2: "bg-card-tint-yellow text-charcoal",
  p3: "bg-card-tint-gray text-slate",
};

const badge = "whitespace-nowrap rounded-xs px-1.5 py-0.5 text-micro";
const SILENT_REASONS = new Set(["sync", "moved on board"]);

export function KindIcon({ item }: { item: Pick<ItemSummary, "kind" | "state"> }) {
  if (item.kind === "pr") {
    if (item.state === "merged") return <MergedIcon className="shrink-0 text-brand-purple" aria-label="Merged pull request" />;
    return (
      <PullRequestIcon
        className={item.state === "open" ? "shrink-0 text-semantic-success" : "shrink-0 text-stone"}
        aria-label={item.state === "open" ? "Open pull request" : "Closed pull request"}
      />
    );
  }
  return item.state === "open" ? (
    <IssueOpenIcon className="shrink-0 text-semantic-success" aria-label="Open issue" />
  ) : (
    <IssueClosedIcon className="shrink-0 text-brand-purple" aria-label="Closed issue" />
  );
}

export function Card({
  item,
  owner,
  onOpen,
  onMove,
}: {
  item: ItemSummary;
  owner: string;
  onOpen: (ref: string) => void;
  onMove: (ref: string, column: BoardColumn) => void;
}) {
  // Mouse-only drag (see board.tsx sensors); keyboard and touch users move via the select or the drawer.
  const { listeners, setNodeRef, isDragging } = useDraggable({ id: item.ref });
  const unseen = isUnseen(item);
  const reviewRequested = isReviewRequested(item, owner);

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      className={
        isDragging
          ? "rounded-md border border-primary bg-canvas opacity-50"
          : "rounded-md border border-hairline bg-canvas transition-colors duration-150 hover:border-hairline-strong md:cursor-grab"
      }
    >
      <button
        type="button"
        onClick={() => onOpen(item.ref)}
        className="block w-full rounded-md p-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <span className="flex items-center gap-1.5 text-caption text-stone">
          <KindIcon item={item} />
          <span className="truncate font-mono">
            {item.repo}#{item.number}
          </span>
          {unseen ? (
            <span className="ml-auto flex shrink-0 items-center gap-1 text-micro text-primary">
              <span aria-hidden className="h-2 w-2 rounded-full bg-primary" />
              new
            </span>
          ) : null}
        </span>
        <span className="mt-1.5 line-clamp-3 block text-body-sm font-medium text-ink">{item.title}</span>
        {item.priority || reviewRequested || item.unansweredOwnerMention || item.hasDraft || item.isDraft ? (
          <span className="mt-2 flex flex-wrap items-center gap-1.5">
            {item.priority ? (
              <span className={`${badge} ${PRIORITY_CLASS[item.priority]}`}>{item.priority.toUpperCase()}</span>
            ) : null}
            {reviewRequested ? <span className={`${badge} bg-card-tint-sky text-ink`}>review requested</span> : null}
            {item.unansweredOwnerMention ? <span className={`${badge} bg-card-tint-rose text-ink`}>@you</span> : null}
            {item.hasDraft ? <span className={`${badge} bg-card-tint-mint text-ink`}>draft reply</span> : null}
            {item.isDraft ? <span className={`${badge} bg-card-tint-gray text-slate`}>draft PR</span> : null}
          </span>
        ) : null}
        {item.lastReason && !SILENT_REASONS.has(item.lastReason) ? (
          <span className="mt-2 line-clamp-2 block border-l-2 border-hairline pl-2 text-caption text-slate">
            {item.lastReason}
          </span>
        ) : null}
        <span className="mt-2 block truncate text-micro text-stone">
          {item.author} · updated {relativeTime(item.updatedAt)}
        </span>
      </button>
      <div className="border-t border-hairline px-3 py-2 md:hidden">
        <label className="flex items-center gap-2 text-caption text-slate">
          Move to
          <select
            value={item.column}
            onChange={(e) => onMove(item.ref, e.target.value as BoardColumn)}
            className="min-h-8 flex-1 rounded-sm border border-hairline bg-canvas px-2 text-caption text-ink focus-visible:outline-2 focus-visible:outline-primary"
          >
            {COLUMNS.map((c) => (
              <option key={c} value={c}>
                {COLUMN_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
