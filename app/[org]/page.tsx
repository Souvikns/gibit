import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExternalLinkIcon, RepoIcon } from "@/components/icons";
import { OrgSearch } from "@/components/landing/org-search";
import { SiteNav } from "@/components/landing/site-nav";
import { fetchOrg, GitHubError, isValidLogin, searchOrgIssues } from "@/lib/github";
import { ErrorCard } from "./error-card";
import { IssuesBrowser } from "./issues-browser";

interface OrgPageProps {
  params: Promise<{ org: string }>;
}

export async function generateMetadata({ params }: OrgPageProps): Promise<Metadata> {
  const { org } = await params;
  return { title: `${org} issues — gibit` };
}

export default async function OrgPage({ params }: OrgPageProps) {
  const { org } = await params;
  if (!isValidLogin(org)) notFound();

  let profile: Awaited<ReturnType<typeof fetchOrg>>;
  let result: Awaited<ReturnType<typeof searchOrgIssues>>;
  try {
    [profile, result] = await Promise.all([fetchOrg(org), searchOrgIssues(org)]);
  } catch (error) {
    if (error instanceof GitHubError) {
      if (error.kind === "not-found") notFound();
      return (
        <Shell>
          <ErrorCard
            kind={error.kind === "rate-limited" ? "rate-limited" : "api"}
            org={org}
            resetAt={error.resetAt}
          />
        </Shell>
      );
    }
    throw error;
  }

  const metaParts = [
    `${profile.publicRepos.toLocaleString()} public repos`,
    `${profile.followers.toLocaleString()} followers`,
    ...(result.openCount !== null
      ? [`${result.openCount.toLocaleString()} open issues`]
      : []),
  ];

  return (
    <Shell>
      <header className="border-b border-hairline pb-8">
        <div className="flex items-start gap-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={profile.avatarUrl}
            alt=""
            width={72}
            height={72}
            className="shrink-0 rounded-lg border border-hairline"
          />
          <div className="min-w-0">
            <h1 className="text-heading-2 text-ink">{profile.name}</h1>
            <p className="mt-1 text-body-md text-stone">@{profile.login}</p>
            {profile.description && (
              <p className="mt-3 max-w-2xl text-body-md text-slate">{profile.description}</p>
            )}
            <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-body-sm text-stone">
              <RepoIcon className="h-4 w-4" />
              {metaParts.join(" · ")}
              <span aria-hidden>·</span>
              <a
                href={profile.htmlUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-medium text-link-blue transition-colors duration-150 hover:text-link-blue-pressed"
              >
                View on GitHub
                <ExternalLinkIcon className="h-3.5 w-3.5" />
              </a>
            </p>
          </div>
        </div>
      </header>

      <IssuesBrowser
        issues={result.issues}
        totalCount={result.totalCount}
        truncated={result.truncated}
      />
      <div className="h-section" />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav right={<OrgSearch variant="nav" />} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-10">{children}</main>
    </div>
  );
}
