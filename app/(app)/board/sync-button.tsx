"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { syncStepAction } from "../settings/actions";

export function SyncButton() {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  function run() {
    setError(false);
    startTransition(async () => {
      for (let i = 0; i < 50; i++) {
        const result = await syncStepAction();
        if ("error" in result) {
          setStatus(result.error);
          setError(true);
          return;
        }
        setStatus(result.status === "partial" ? `Syncing… ${result.reposDone}/${result.reposTotal} repos` : result.message);
        if (result.status !== "partial" || result.rateLimitResetAt) break;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-3">
      {status ? (
        <p role="status" className={error ? "text-caption text-semantic-error" : "hidden text-caption text-slate sm:block"}>
          {status}
        </p>
      ) : null}
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="min-h-9 shrink-0 rounded-md bg-primary px-4 text-body-sm font-medium text-on-primary transition-colors duration-150 hover:bg-primary-pressed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
      >
        {pending ? "Syncing…" : "Sync"}
      </button>
    </div>
  );
}
