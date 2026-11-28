"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { ActionBadge, EffortImpact } from "@/components/assessment-badges";
import { NEXT_ACTION_LABELS, QUADRANT_LABELS, QUADRANTS, rankFocus, type Quadrant, type RankedItem } from "@/lib/focus";
import { NEXT_ACTIONS, type NextAction } from "@/lib/model";
import type { ItemSummary } from "@/lib/triage/types";
import { relativeTime } from "@/lib/time";
import { KindIcon } from "../triage/card";
import { Drawer } from "../triage/drawer";
import { SyncButton } from "../triage/sync-button";

const ACTION_FILTERS = NEXT_ACTIONS.filter((a) => a !== "wait");
const QUADRANT_HINT: Record<Quadrant, string> = {
  quick_wins: "high impact · low effort",
  big_bets: "high impact · high effort",
  fill_ins: "low impact · low effort",
  ignore: "low impact · high effort",
};

const chip = "min-h-9 shrink-0 whitespace-nowrap rounded-full px-3 text-caption focus-visible:outline-2 focus-visible:outline-primary";
const chipOn = `${chip} bg-ink font-medium text-on-dark`;
const chipOff = `${chip} bg-surface text-slate hover:text-ink`;

function CopyAsk({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async (e) => {
        e.stopPropagation();
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="min-h-7 shrink-0 rounded-sm border border-hairline px-2 text-micro text-slate hover:bg-surface hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
    >
      {copied ? "Copied" : "Copy ask"}
    </button>
  );
}

function Row({ entry, rank, onOpen }: { entry: RankedItem; rank: number; onOpen: (ref: string) => void }) {
  const { item, assessment } = entry;
  return (
    <li className="rounded-md border border-hairline bg-canvas transition-colors duration-150 hover:border-hairline-strong">
      <button
        type="button"
        onClick={() => onOpen(item.ref)}
        className="flex w-full gap-3 rounded-md p-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:p-4"
      >
        <span aria-hidden className="w-5 shrink-0 pt-0.5 text-right font-mono text-caption text-stone">
          {rank}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <ActionBadge action={assessment.nextAction} />
            <span className="flex min-w-0 items-center gap-1 text-caption text-stone">
              <KindIcon item={item} />
              <span className="truncate font-mono">
                {item.repo}#{item.number}
              </span>
            </span>
            <EffortImpact assessment={assessment} />
            {item.hasDraft ? <span className="rounded-xs bg-card-tint-mint px-1.5 py-0.5 text-micro text-ink">draft ready</span> : null}
            {assessment.confidence === "low" ? (
              <span className="rounded-xs bg-card-tint-yellow px-1.5 py-0.5 text-micro text-charcoal">unsure</span>
            ) : null}
            {item.needsAssessment ? (
              <span className="rounded-xs bg-card-tint-rose px-1.5 py-0.5 text-micro text-ink">changed since assessed</span>
            ) : null}
          </span>
          <span className="mt-1.5 block text-body-sm font-medium text-ink">{assessment.summary}</span>
          <span className="mt-0.5 block truncate text-caption text-stone">{item.title}</span>
          {assessment.whyNow ? <span className="mt-1.5 block text-caption text-slate">↳ {assessment.whyNow}</span> : null}
        </span>
      </button>
      {assessment.blockedBy ? (
        <div className="flex items-start gap-3 border-t border-hairline px-3 py-2 sm:px-4">
          <p className="min-w-0 flex-1 text-caption text-charcoal">
            <span className="font-medium text-ink">Ask @{assessment.blockedBy.login}:</span> {assessment.blockedBy.ask}
            <span className="block text-micro text-stone">{assessment.blockedBy.reason}</span>
          </p>
          <CopyAsk text={assessment.blockedBy.ask} />
        </div>
      ) : null}
    </li>
  );
}

export function Focus({
  initialItems,
  owner,
  now,
  lastSyncStatus,
}: {
  initialItems: ItemSummary[];
  owner: string;
  now: number;
  lastSyncStatus: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const openRef = searchParams.get("item");

  const [items, setItems] = useState(initialItems);
  const [quadrantFilter, setQuadrantFilter] = useState<Quadrant | null>(null);
  const [actionFilter, setActionFilter] = useState<NextAction | null>(null);
  const [showWaiting, setShowWaiting] = useState(false);

  const { ranked, unassessed } = useMemo(() => rankFocus(items, owner, now), [items, owner, now]);
  const needsAssessment = items.filter((i) => i.needsAssessment).length;

  const quadrantCounts = useMemo(() => {
    const counts: Record<Quadrant, number> = { quick_wins: 0, big_bets: 0, fill_ins: 0, ignore: 0 };
    for (const r of ranked) if (r.assessment.nextAction !== "wait") counts[r.quadrant]++;
    return counts;
  }, [ranked]);

  const waiting = ranked.filter((r) => r.assessment.nextAction === "wait");
  const visible = ranked.filter(
    (r) =>
      r.assessment.nextAction !== "wait" &&
      (!quadrantFilter || r.quadrant === quadrantFilter) &&
      (!actionFilter || r.assessment.nextAction === actionFilter),
  );

  const open = useCallback(
    (ref: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("item", ref);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const close = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("item");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const updateItem = useCallback((next: ItemSummary) => {
    setItems((prev) => prev.map((i) => (i.ref === next.ref ? next : i)));
  }, []);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-heading-4 text-ink">Focus</h1>
          <p className="text-caption text-stone">
            {ranked.length - waiting.length} to act on · {waiting.length} waiting
            {lastSyncStatus === "partial" ? " · last sync didn't finish" : ""}
          </p>
        </div>
        <SyncButton />
      </div>

      {needsAssessment > 0 ? (
        <p className="rounded-md bg-card-tint-yellow px-4 py-3 text-body-sm text-charcoal">
          <span className="font-medium text-ink">
            {needsAssessment} item{needsAssessment === 1 ? "" : "s"} need{needsAssessment === 1 ? "s" : ""} assessment.
          </span>{" "}
          Run <code className="rounded-xs bg-canvas px-1 font-mono text-caption">/mcp__gibit__triage</code> in Claude Code.
        </p>
      ) : null}

      <div role="group" aria-label="Effort and impact" className="grid grid-cols-2 gap-2">
        {QUADRANTS.map((q) => {
          const active = quadrantFilter === q;
          return (
            <button
              key={q}
              type="button"
              aria-pressed={active}
              onClick={() => setQuadrantFilter(active ? null : q)}
              className={
                active
                  ? "flex min-h-16 flex-col items-start justify-center rounded-lg border-2 border-primary bg-card-tint-lavender px-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  : "flex min-h-16 flex-col items-start justify-center rounded-lg border-2 border-transparent bg-surface px-3 py-2 text-left hover:border-hairline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              }
            >
              <span className="flex w-full items-baseline justify-between gap-2">
                <span className="text-body-sm font-medium text-ink">{QUADRANT_LABELS[q]}</span>
                <span className="text-heading-5 text-ink">{quadrantCounts[q]}</span>
              </span>
              <span className="text-micro text-stone">{QUADRANT_HINT[q]}</span>
            </button>
          );
        })}
      </div>

      <div role="group" aria-label="Next action" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        <button type="button" aria-pressed={!actionFilter} onClick={() => setActionFilter(null)} className={!actionFilter ? chipOn : chipOff}>
          All
        </button>
        {ACTION_FILTERS.map((a) => (
          <button
            key={a}
            type="button"
            aria-pressed={actionFilter === a}
            onClick={() => setActionFilter(actionFilter === a ? null : a)}
            className={actionFilter === a ? chipOn : chipOff}
          >
            {NEXT_ACTION_LABELS[a]}
          </button>
        ))}
      </div>

      <section aria-label="Do next" className="flex flex-col gap-2">
        <h2 className="text-caption font-medium uppercase tracking-wide text-stone">Do next</h2>
        {visible.length === 0 ? (
          <p className="rounded-md border border-dashed border-hairline px-4 py-8 text-center text-body-sm text-slate">
            {ranked.length === 0
              ? "Nothing assessed yet. Run /mcp__gibit__triage in Claude Code."
              : "Nothing matches these filters."}
          </p>
        ) : (
          <ol className="flex flex-col gap-2">
            {visible.map((entry, index) => (
              <Row key={entry.item.ref} entry={entry} rank={index + 1} onOpen={open} />
            ))}
          </ol>
        )}
      </section>

      {waiting.length > 0 ? (
        <section aria-label="Waiting" className="flex flex-col gap-2">
          <button
            type="button"
            aria-expanded={showWaiting}
            onClick={() => setShowWaiting((v) => !v)}
            className="min-h-9 self-start rounded-md text-caption font-medium uppercase tracking-wide text-stone hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
          >
            {showWaiting ? "Hide" : "Show"} waiting ({waiting.length})
          </button>
          {showWaiting ? (
            <ol className="flex flex-col gap-2">
              {waiting.map((entry, index) => (
                <Row key={entry.item.ref} entry={entry} rank={index + 1} onOpen={open} />
              ))}
            </ol>
          ) : null}
        </section>
      ) : null}

      {unassessed.length > 0 ? (
        <details className="rounded-lg border border-hairline">
          <summary className="flex min-h-11 cursor-pointer list-none items-center px-4 text-caption font-medium uppercase tracking-wide text-stone hover:text-ink focus-visible:outline-2 focus-visible:outline-primary">
            Not assessed ({unassessed.length})
          </summary>
          <ul className="divide-y divide-hairline border-t border-hairline">
            {unassessed.slice(0, 100).map((item) => (
              <li key={item.ref}>
                <button
                  type="button"
                  onClick={() => open(item.ref)}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <KindIcon item={item} />
                  <span className="shrink-0 font-mono text-caption text-stone">
                    {item.repo}#{item.number}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-body-sm text-ink">{item.title}</span>
                  <span className="shrink-0 text-micro text-stone">{relativeTime(item.updatedAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {openRef ? <Drawer itemRef={openRef} onClose={close} onChanged={updateItem} /> : null}
    </div>
  );
}
