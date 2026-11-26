"use client";

import { useState, useTransition } from "react";
import type { SyncProgress } from "@/lib/sync/run";
import { syncStepAction } from "./actions";

export function SyncPanel({ initial }: { initial: SyncProgress | null }) {
  const [progress, setProgress] = useState<SyncProgress | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    setError(null);
    startTransition(async () => {
      for (let i = 0; i < 50; i++) {
        const result = await syncStepAction();
        if ("error" in result) {
          setError(result.error);
          return;
        }
        setProgress(result);
        if (result.status !== "partial" || result.rateLimitResetAt) return;
      }
    });
  }

  const pct = progress && progress.reposTotal > 0 ? Math.round((progress.reposDone / progress.reposTotal) * 100) : 0;

  return (
    <div className="flex flex-col gap-3 rounded-md border border-hairline p-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-body-sm text-slate">
          {progress ? progress.message || `Last sync: ${progress.status}` : "Never synced."}
        </p>
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="shrink-0 rounded-md bg-primary px-4 py-2 text-body-sm font-medium text-on-primary transition-colors duration-150 hover:bg-primary-pressed disabled:opacity-60"
        >
          {pending ? "Syncing…" : "Sync now"}
        </button>
      </div>
      {pending && progress && (
        <div className="h-1.5 w-full overflow-hidden rounded-xs bg-surface">
          <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}
      {progress?.errors.map((e) => (
        <p key={e.repo} className="text-caption text-semantic-error">
          {e.repo}: {e.message}
        </p>
      ))}
      {error && <p className="text-body-sm text-semantic-error">{error}</p>}
    </div>
  );
}
