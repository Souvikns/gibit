import { GitHubMark } from "@/components/icons";
import { FeatureGrid } from "@/components/landing/feature-grid";
import { Hero } from "@/components/landing/hero";
import { MockIssueCard } from "@/components/landing/mock-issue-card";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteNav } from "@/components/landing/site-nav";
import { Steps } from "@/components/landing/steps";
import { YellowBanner } from "@/components/landing/yellow-banner";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav
        right={
          <a
            href="https://github.com/souvikns/gibit"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-2 rounded-sm px-3 text-body-sm font-medium text-ink transition-colors duration-150 hover:bg-surface"
          >
            <GitHubMark className="h-4 w-4" />
            <span className="hidden sm:inline">Source</span>
          </a>
        }
      />
      <main className="flex-1">
        <Hero />
        <div className="relative z-10 mx-auto -mt-32 w-full max-w-3xl px-6">
          <MockIssueCard />
        </div>
        <FeatureGrid />
        <YellowBanner />
        <Steps />
      </main>
      <SiteFooter />
    </div>
  );
}
