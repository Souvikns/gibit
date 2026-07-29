import type { ReactNode } from "react";

function MergeSketch() {
  return (
    <div className="flex h-full flex-col justify-center gap-2">
      {[
        { dot: "bg-brand-teal", width: "w-3/5" },
        { dot: "bg-brand-orange", width: "w-2/5" },
        { dot: "bg-brand-pink", width: "w-1/2" },
      ].map((row) => (
        <div key={row.dot} className="flex items-center gap-2">
          <span className={`h-2 w-2 shrink-0 rounded-full ${row.dot}`} />
          <span className={`h-2 rounded-full bg-charcoal/20 ${row.width}`} />
        </div>
      ))}
      <div className="my-1 h-px w-full bg-charcoal/15" />
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
        <span className="h-2 w-full rounded-full bg-charcoal/35" />
      </div>
    </div>
  );
}

function FilterSketch() {
  return (
    <div className="flex h-full flex-col justify-center gap-3">
      <div className="flex gap-1.5">
        <span className="rounded-full bg-ink-deep px-2.5 py-1 text-[10px] font-medium text-on-dark">
          Open
        </span>
        <span className="rounded-full border border-charcoal/25 px-2.5 py-1 text-[10px] font-medium text-charcoal/60">
          Closed
        </span>
        <span className="rounded-full border border-charcoal/25 px-2.5 py-1 text-[10px] font-medium text-charcoal/60">
          All
        </span>
      </div>
      <div className="flex h-7 items-center rounded-md border border-charcoal/20 bg-canvas/60 px-2.5">
        <span className="h-2 w-2/5 rounded-full bg-charcoal/25" />
      </div>
    </div>
  );
}

function SortSketch() {
  return (
    <div className="flex h-full items-end justify-center gap-2 pb-1">
      {[35, 60, 45, 85, 100].map((height, index) => (
        <span
          key={height}
          className={`w-5 rounded-xs ${index === 4 ? "bg-primary" : "bg-charcoal/25"}`}
          style={{ height: `${height}%` }}
        />
      ))}
    </div>
  );
}

const FEATURES: {
  tint: string;
  title: string;
  body: string;
  sketch: ReactNode;
}[] = [
  {
    tint: "bg-card-tint-sky",
    title: "One search, every repo",
    body: "Issues from dozens of repositories collapse into a single chronological stream. No more tab-hopping across an org.",
    sketch: <MergeSketch />,
  },
  {
    tint: "bg-card-tint-mint",
    title: "Filter the noise",
    body: "Slice by state, repository, or keyword. Surface good first issues without the archaeology.",
    sketch: <FilterSketch />,
  },
  {
    tint: "bg-card-tint-lavender",
    title: "Sort by what matters",
    body: "Newest, recently updated, or most commented — see what the community actually cares about, first.",
    sketch: <SortSketch />,
  },
];

export function FeatureGrid() {
  return (
    <section className="mx-auto max-w-7xl px-6 pt-section-lg pb-section">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-heading-2 text-ink">Bring every issue together</h2>
        <p className="mt-4 text-subtitle text-slate">
          An organization&apos;s best contribution opportunities are scattered
          across repos. Gibit puts them in one place.
        </p>
      </div>
      <div className="mt-14 grid gap-6 md:grid-cols-3">
        {FEATURES.map((feature) => (
          <article key={feature.title} className={`rounded-lg p-8 ${feature.tint}`}>
            <div className="mb-6 h-28 rounded-md border border-charcoal/10 bg-canvas/40 p-4">
              {feature.sketch}
            </div>
            <h3 className="text-heading-4 text-charcoal">{feature.title}</h3>
            <p className="mt-2 text-body-sm text-charcoal/80">{feature.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
