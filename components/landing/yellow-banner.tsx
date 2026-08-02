import Link from "next/link";
import { EXAMPLE_ORGS } from "@/lib/constants";

export function YellowBanner() {
  return (
    <section className="mx-auto max-w-7xl px-6 pb-section">
      <div className="flex flex-col justify-between gap-8 rounded-lg bg-card-tint-yellow-bold p-10 md:flex-row md:items-center md:p-14">
        <div className="max-w-xl">
          <h2 className="text-heading-3 text-charcoal">
            Hunting for your first contribution?
          </h2>
          <p className="mt-3 text-body-md text-charcoal/80">
            Filter for open issues, sort by most commented, and find where a
            helping hand is actually needed — not where the queue is longest.
          </p>
        </div>
        <Link
          href={`/${EXAMPLE_ORGS[0]}`}
          className="inline-flex h-11 shrink-0 items-center rounded-md bg-ink-deep px-[18px] text-body-sm font-medium text-on-dark transition-colors duration-150 hover:bg-charcoal"
        >
          Explore {EXAMPLE_ORGS[0]}&rsquo;s issues
        </Link>
      </div>
    </section>
  );
}
