import { CommentIcon, IssueClosedIcon, IssueOpenIcon, SearchIcon } from "@/components/icons";

const MOCK_ISSUES = [
  {
    state: "open" as const,
    title: "App Router: params should be awaited in TypeScript types",
    chips: [
      { label: "bug", classes: "bg-card-tint-rose text-brand-pink-deep" },
      { label: "next.js", classes: "bg-card-tint-sky text-link-blue-pressed" },
    ],
    meta: "#78123 · next.js · opened 2d ago · 48 comments",
  },
  {
    state: "open" as const,
    title: "Add first-class support for React view transitions",
    chips: [{ label: "enhancement", classes: "bg-card-tint-mint text-brand-green" }],
    meta: "#77041 · next.js · opened 4d ago · 132 comments",
  },
  {
    state: "closed" as const,
    title: "Docs: clarify cache behavior of fetch in route handlers",
    chips: [{ label: "documentation", classes: "bg-card-tint-lavender text-brand-purple-800" }],
    meta: "#76902 · next.js · closed 1w ago",
  },
  {
    state: "open" as const,
    title: "Turbopack: HMR drops CSS modules in monorepo setups",
    chips: [
      { label: "bug", classes: "bg-card-tint-rose text-brand-pink-deep" },
      { label: "good first issue", classes: "bg-card-tint-yellow text-brand-brown" },
    ],
    meta: "#1024 · turbo · opened 1w ago · 17 comments",
  },
];

/** Static product preview that breaks out of the hero band. */
export function MockIssueCard() {
  return (
    <div className="overflow-hidden rounded-lg border border-hairline bg-canvas text-left shadow-mockup">
      <div className="flex items-center gap-3 border-b border-hairline px-5 py-3">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-hairline-strong" />
          <span className="h-2.5 w-2.5 rounded-full bg-hairline-strong" />
          <span className="h-2.5 w-2.5 rounded-full bg-hairline-strong" />
        </div>
        <div className="flex h-8 flex-1 items-center gap-2 rounded-md border border-hairline bg-surface px-3 text-body-sm text-steel">
          <SearchIcon className="h-3.5 w-3.5 text-stone" />
          vercel — 500 issues collated
        </div>
      </div>
      <ul className="divide-y divide-hairline-soft">
        {MOCK_ISSUES.map((issue) => (
          <li key={issue.title} className="flex items-center gap-3 px-5 py-4">
            {issue.state === "open" ? (
              <IssueOpenIcon className="h-4 w-4 shrink-0 text-semantic-success" />
            ) : (
              <IssueClosedIcon className="h-4 w-4 shrink-0 text-primary" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-body-md font-medium text-ink">{issue.title}</span>
                {issue.chips.map((chip) => (
                  <span
                    key={chip.label}
                    className={`rounded-sm px-2 py-0.5 text-caption font-semibold ${chip.classes}`}
                  >
                    {chip.label}
                  </span>
                ))}
              </div>
              <p className="mt-1 text-caption text-stone">{issue.meta}</p>
            </div>
            <CommentIcon className="h-4 w-4 shrink-0 text-muted" />
          </li>
        ))}
      </ul>
    </div>
  );
}
