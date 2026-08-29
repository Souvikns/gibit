import Link from "next/link";
import { EXAMPLE_ORGS } from "@/lib/constants";
import { IssuePreview } from "./mock-issue-card";
import { OrgSearch } from "./org-search";

export function Hero() {
  return (
    <section className="mx-auto max-w-7xl px-6 pt-16 sm:pt-24">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center lg:gap-16">
        <div>
          <p className="text-micro font-semibold tracking-[1px] text-steel uppercase">
            Open source issue explorer
          </p>
          <h1 className="mt-5 text-heading-1 text-ink sm:text-display-lg">
            Find the issue worth fixing.
          </h1>
          <p className="mt-6 max-w-md text-subtitle text-slate">
            Gibit collates issues from every repo in a GitHub organization into
            one fast, filterable list.
          </p>
          <div className="mt-8">
            <OrgSearch variant="hero" />
          </div>
          <p className="mt-5 text-body-sm text-stone">
            Try:{" "}
            {EXAMPLE_ORGS.map((org, index) => (
              <span key={org}>
                {index > 0 && " · "}
                <Link
                  href={`/${org}`}
                  className="text-ink underline decoration-hairline-strong underline-offset-4 transition-colors duration-150 hover:decoration-ink"
                >
                  {org}
                </Link>
              </span>
            ))}
          </p>
        </div>
        <IssuePreview />
      </div>
    </section>
  );
}
