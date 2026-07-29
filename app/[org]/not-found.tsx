import { OrgSearch } from "@/components/landing/org-search";
import { SiteNav } from "@/components/landing/site-nav";

export default function OrgNotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        <h1 className="text-heading-1 text-ink">Organization not found</h1>
        <p className="mt-4 text-body-md text-slate">
          We couldn&apos;t find a GitHub organization with that name. Check the
          spelling, or try another org below.
        </p>
        <div className="mt-8 w-full">
          <OrgSearch variant="hero" />
        </div>
      </main>
    </div>
  );
}
