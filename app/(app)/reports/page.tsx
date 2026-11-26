import { Markdown } from "@/components/markdown";
import { listReports } from "@/lib/triage/service";
import { relativeTime } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const reports = await listReports(30);
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-heading-4 text-ink">Reports</h1>
        <p className="text-caption text-stone">Actionable summaries Claude writes after each triage run.</p>
      </div>
      {reports.length === 0 ? (
        <div className="rounded-lg border border-dashed border-hairline px-6 py-10 text-center">
          <p className="text-body-md text-ink">No reports yet</p>
          <p className="mt-1 text-body-sm text-slate">
            Run <code className="rounded-xs bg-surface px-1 font-mono text-caption">/mcp__gibit__triage</code> in Claude Code.
            Claude will sync, sort the board, and save a report here.
          </p>
        </div>
      ) : (
        reports.map((report, index) => (
          <details
            key={report.id}
            open={index === 0}
            className="group rounded-lg border border-hairline bg-canvas"
          >
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 focus-visible:outline-2 focus-visible:outline-primary">
              <span className="text-body-md font-medium text-ink">{report.title}</span>
              <time dateTime={report.createdAt} className="shrink-0 text-caption text-stone">
                {relativeTime(report.createdAt)}
              </time>
            </summary>
            <div className="border-t border-hairline px-5 py-4">
              <Markdown>{report.body}</Markdown>
            </div>
          </details>
        ))
      )}
    </div>
  );
}
