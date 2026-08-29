import { IssueClosedIcon, IssueOpenIcon, RepoIcon } from "@/components/icons";
import { labelTint } from "@/lib/issues";

function PreviewLabel({ name, color }: { name: string; color: string }) {
  const tint = labelTint(color);
  return (
    <span
      className="rounded-sm px-2 py-0.5 text-caption font-semibold"
      style={{ backgroundColor: tint.background, color: tint.color }}
    >
      {name}
    </span>
  );
}

const PREVIEW_ISSUES = [
  {
    state: "open" as const,
    title: "App Router: params should be awaited in TypeScript types",
    labels: [
      { name: "bug", color: "d73a4a" },
      { name: "next.js", color: "0075de" },
    ],
    meta: "#78123 · next.js · 2d ago",
  },
  {
    state: "open" as const,
    title: "Add first-class support for React view transitions",
    labels: [{ name: "enhancement", color: "1aae39" }],
    meta: "#77041 · next.js · 4d ago",
  },
  {
    state: "closed" as const,
    title: "Docs: clarify cache behavior of fetch in route handlers",
    labels: [{ name: "documentation", color: "7b3ff2" }],
    meta: "#76902 · next.js · 1w ago",
  },
  {
    state: "open" as const,
    title: "Turbopack: HMR drops CSS modules in monorepo setups",
    labels: [
      { name: "bug", color: "d73a4a" },
      { name: "good first issue", color: "f5d75e" },
    ],
    meta: "#1024 · turbo · 1w ago",
  },
];

/** Static preview of the real issue-browser UI, embedded in the hero. */
export function IssuePreview() {
  return (
    <div className="overflow-hidden rounded-lg border border-hairline bg-canvas text-left shadow-mockup">
      <div className="flex items-center gap-2 border-b border-hairline px-5 py-3.5">
        <RepoIcon className="h-4 w-4 shrink-0 text-stone" />
        <span className="truncate font-mono text-body-sm text-steel">
          github.com/<span className="font-medium text-ink">vercel</span>
        </span>
        <span className="ml-auto shrink-0 text-caption text-stone tabular-nums">500 issues</span>
      </div>
      <ul className="divide-y divide-hairline-soft">
        {PREVIEW_ISSUES.map((issue) => (
          <li key={issue.title} className="flex items-start gap-3 px-5 py-4">
            {issue.state === "open" ? (
              <IssueOpenIcon className="mt-0.5 h-4 w-4 shrink-0 text-semantic-success" />
            ) : (
              <IssueClosedIcon className="mt-0.5 h-4 w-4 shrink-0 text-steel" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-body-sm font-medium text-ink">{issue.title}</p>
              <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {issue.labels.map((label) => (
                  <PreviewLabel key={label.name} name={label.name} color={label.color} />
                ))}
                <span className="font-mono text-caption text-stone">{issue.meta}</span>
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
