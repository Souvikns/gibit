import { CommentIcon, IssueClosedIcon, IssueOpenIcon } from "@/components/icons";
import { labelTint, type IssueItem } from "@/lib/issues";
import { relativeTime } from "@/lib/time";

const MAX_VISIBLE_LABELS = 3;

function LabelChip({ name, color }: { name: string; color: string }) {
  const tint = labelTint(name);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-caption font-semibold ${tint.chip}`}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: `#${color}` }}
      />
      {name}
    </span>
  );
}

export function IssueRow({ issue }: { issue: IssueItem }) {
  const visibleLabels = issue.labels.slice(0, MAX_VISIBLE_LABELS);
  const hiddenCount = issue.labels.length - visibleLabels.length;

  return (
    <li className="flex items-start gap-3 px-5 py-4 transition-colors duration-150 hover:bg-surface">
      {issue.state === "open" ? (
        <IssueOpenIcon className="mt-1 h-4 w-4 shrink-0 text-semantic-success" />
      ) : (
        <IssueClosedIcon className="mt-1 h-4 w-4 shrink-0 text-primary" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <a
            href={issue.url}
            target="_blank"
            rel="noreferrer"
            className="text-body-md font-medium text-ink transition-colors duration-150 hover:text-link-blue"
          >
            {issue.title}
          </a>
          {visibleLabels.map((label) => (
            <LabelChip key={label.name} name={label.name} color={label.color} />
          ))}
          {hiddenCount > 0 && (
            <span className="rounded-sm bg-card-tint-gray px-2 py-0.5 text-caption font-semibold text-slate">
              +{hiddenCount}
            </span>
          )}
        </div>
        <p suppressHydrationWarning className="mt-1 text-caption text-stone">
          #{issue.number} · {issue.repo} · opened {relativeTime(issue.createdAt)} by{" "}
          {issue.author}
        </p>
      </div>
      {issue.comments > 0 && (
        <span className="flex shrink-0 items-center gap-1.5 pt-1 text-caption text-steel">
          <CommentIcon className="h-3.5 w-3.5" />
          <span className="tabular-nums">{issue.comments}</span>
        </span>
      )}
    </li>
  );
}
