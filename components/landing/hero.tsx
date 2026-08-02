import Link from "next/link";
import { EXAMPLE_ORGS } from "@/lib/constants";
import { OrgSearch } from "./org-search";

/** Brand-colored sticky-note dots scattered around the hero, per design.md. */
function StickyNotes() {
  const notes = [
    "top-[18%] left-[9%] h-7 w-7 rotate-[-8deg] bg-brand-pink",
    "top-[30%] left-[16%] h-4 w-4 rotate-[12deg] bg-brand-yellow",
    "top-[14%] right-[11%] h-6 w-6 rotate-[10deg] bg-brand-teal",
    "top-[38%] right-[7%] h-4 w-4 rotate-[-14deg] bg-brand-orange",
    "top-[55%] left-[6%] h-5 w-5 rotate-[6deg] bg-brand-green",
    "top-[58%] right-[15%] h-7 w-7 rotate-[-6deg] bg-brand-purple-300",
  ];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 hidden md:block">
      {notes.map((classes) => (
        <div key={classes} className={`absolute rounded-xs opacity-90 shadow-card ${classes}`} />
      ))}
      {/* Mesh wire decoration */}
      <svg
        className="absolute -bottom-24 -left-24 h-96 w-96 text-on-dark/10"
        viewBox="0 0 200 200"
        fill="none"
        stroke="currentColor"
      >
        <circle cx="100" cy="100" r="40" />
        <circle cx="100" cy="100" r="70" />
        <circle cx="100" cy="100" r="100" />
        <path d="M0 100h200M100 0v200" />
      </svg>
      <svg
        className="absolute -top-20 right-[22%] h-64 w-64 text-on-dark/10"
        viewBox="0 0 200 200"
        fill="none"
        stroke="currentColor"
      >
        <ellipse cx="100" cy="100" rx="90" ry="36" />
        <ellipse cx="100" cy="100" rx="90" ry="68" />
        <ellipse cx="100" cy="100" rx="36" ry="90" />
      </svg>
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-brand-navy">
      <StickyNotes />
      <div className="relative mx-auto max-w-7xl px-6 pt-20 pb-48 text-center sm:pt-28">
        <p className="text-micro font-semibold tracking-[1px] text-on-dark-muted uppercase">
          Open source issue explorer
        </p>
        <h1 className="mx-auto mt-5 max-w-4xl text-heading-1 text-on-dark sm:text-display-lg lg:text-hero-display">
          Find the issue worth fixing.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-subtitle text-on-dark-muted">
          Gibit collates issues from every repo in a GitHub organization into
          one fast, filterable list.
        </p>
        <div className="mt-10">
          <OrgSearch variant="hero" />
        </div>
        <p className="mt-5 text-body-sm text-on-dark-muted">
          Try:{" "}
          {EXAMPLE_ORGS.map((org, index) => (
            <span key={org}>
              {index > 0 && " · "}
              <Link
                href={`/${org}`}
                className="text-on-dark underline decoration-on-dark-muted underline-offset-4 transition-colors duration-150 hover:decoration-on-dark"
              >
                {org}
              </Link>
            </span>
          ))}
        </p>
      </div>
    </section>
  );
}
