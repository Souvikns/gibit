import { OrgShell } from "@/components/org-shell";

export default function OrgLoading() {
  return (
    <OrgShell>
      <div className="motion-safe:animate-pulse">
        <div className="flex items-start gap-5 border-b border-hairline pb-8">
          <div className="h-[72px] w-[72px] shrink-0 rounded-lg bg-surface" />
          <div className="flex-1">
            <div className="h-8 w-56 rounded-md bg-surface" />
            <div className="mt-3 h-4 w-32 rounded-md bg-surface" />
            <div className="mt-4 h-4 w-full max-w-xl rounded-md bg-surface" />
            <div className="mt-4 h-4 w-72 rounded-md bg-surface" />
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          <div className="h-8 w-24 rounded-full bg-surface" />
          <div className="h-8 w-24 rounded-full bg-surface" />
          <div className="h-8 w-20 rounded-full bg-surface" />
          <div className="h-9 flex-1 rounded-md bg-surface" />
        </div>

        <div className="mt-6 divide-y divide-hairline-soft overflow-hidden rounded-lg border border-hairline">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex items-start gap-3 px-5 py-4">
              <div className="mt-1 h-4 w-4 shrink-0 rounded-full bg-surface" />
              <div className="flex-1">
                <div className="h-4 rounded-md bg-surface" style={{ width: `${72 - (i % 4) * 12}%` }} />
                <div className="mt-2.5 h-3 w-2/5 rounded-md bg-surface" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </OrgShell>
  );
}
