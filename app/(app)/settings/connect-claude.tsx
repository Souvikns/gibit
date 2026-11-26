"use client";

import { useState } from "react";

export function ConnectClaude({ origin }: { origin: string }) {
  const url = `${origin}/api/mcp`;
  const command = `claude mcp add --transport http gibit ${url} --header "Authorization: Bearer <GIBIT_SECRET>"`;
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-hairline p-4">
      <p className="text-body-sm text-slate">
        Claude Code connects over MCP with your <code className="rounded-xs bg-surface px-1 font-mono text-caption">GIBIT_SECRET</code>.
        Replace the placeholder with the value from your environment, then run{" "}
        <code className="rounded-xs bg-surface px-1 font-mono text-caption">/mcp__gibit__triage</code> in Claude Code.
      </p>
      <div className="flex items-start gap-2">
        <pre className="min-w-0 flex-1 overflow-x-auto rounded-sm bg-surface px-3 py-2 font-mono text-caption text-ink">{command}</pre>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded-md border border-hairline px-3 py-2 text-body-sm text-ink hover:bg-surface"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
