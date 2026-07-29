"use client";

import { useRouter } from "next/navigation";

interface ErrorCardProps {
  kind: "rate-limited" | "api";
  org: string;
  /** ms epoch, present for rate limits. */
  resetAt?: number;
}

export function ErrorCard({ kind, org, resetAt }: ErrorCardProps) {
  const router = useRouter();
  const resetTime = resetAt
    ? new Date(resetAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="mx-auto max-w-lg py-24 text-center">
      <h1 className="text-heading-2 text-ink">
        {kind === "rate-limited" ? "GitHub rate limit reached" : "GitHub didn't answer"}
      </h1>
      <p className="mt-4 text-body-md text-slate">
        {kind === "rate-limited" ? (
          <>
            Too many requests for <span className="font-medium text-ink">@{org}</span>
            {resetTime && (
              <>
                {" "}
                — the limit resets at{" "}
                <span className="font-medium text-ink">{resetTime}</span>
              </>
            )}
            . Set a <code className="rounded-sm bg-surface px-1.5 py-0.5 text-body-sm">GITHUB_TOKEN</code>{" "}
            environment variable for much higher limits.
          </>
        ) : (
          <>
            GitHub returned an unexpected response while loading{" "}
            <span className="font-medium text-ink">@{org}</span>. It&apos;s usually
            temporary.
          </>
        )}
      </p>
      <button
        onClick={() => router.refresh()}
        className="mt-8 rounded-md bg-primary px-[18px] py-2.5 text-body-sm font-medium text-on-primary transition-colors duration-150 hover:bg-primary-pressed"
      >
        Try again
      </button>
    </div>
  );
}
