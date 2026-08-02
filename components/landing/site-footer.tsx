import Link from "next/link";
import { GitHubMark } from "@/components/icons";
import { EXAMPLE_ORGS } from "@/lib/constants";

const COLUMNS: { heading: string; links: { label: string; href: string; external?: boolean }[] }[] = [
  {
    heading: "Examples",
    links: [
      ...EXAMPLE_ORGS.map((org) => ({ label: org, href: `/${org}` })),
    ],
  },
  {
    heading: "Resources",
    links: [
      {
        label: "GitHub search API",
        href: "https://docs.github.com/en/rest/search/search#search-issues-and-pull-requests",
        external: true,
      },
      {
        label: "Rate limits",
        href: "https://docs.github.com/en/rest/rate-limit",
        external: true,
      },
      { label: "Source on GitHub", href: "https://github.com/souvikns/gibit", external: true },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-hairline">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-section md:grid-cols-[1fr_auto_auto] md:gap-24">
        <div>
          <p className="flex items-center gap-2 text-heading-5 tracking-tight text-ink-deep">
            <GitHubMark className="h-5 w-5" />
            gibit
          </p>
          <p className="mt-3 max-w-xs text-body-sm text-steel">
            Search and collate GitHub issues from a single organization. Find
            the issue worth fixing.
          </p>
        </div>
        {COLUMNS.map((column) => (
          <div key={column.heading}>
            <p className="text-body-sm font-medium text-ink">{column.heading}</p>
            <ul className="mt-3">
              {column.links.map((link) => (
                <li key={link.label}>
                  {link.external ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className="block py-0.5 text-body-sm text-steel transition-colors duration-150 hover:text-ink"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      href={link.href}
                      className="block py-0.5 text-body-sm text-steel transition-colors duration-150 hover:text-ink"
                    >
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </footer>
  );
}
