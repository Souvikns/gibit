import { OrgSearch } from "@/components/landing/org-search";
import { SiteNav } from "@/components/landing/site-nav";

export function OrgShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav right={<OrgSearch variant="nav" />} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-10">{children}</main>
    </div>
  );
}
