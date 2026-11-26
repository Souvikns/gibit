"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { CloseIcon, ExternalLinkIcon } from "@/components/icons";
import { Markdown } from "@/components/markdown";
import { COLUMN_LABELS } from "@/lib/board";
import { COLUMNS, isMaintainerRole, type BoardColumn, type Priority } from "@/lib/model";
import type { ItemDetail, ItemSummary } from "@/lib/triage/types";
import { relativeTime } from "@/lib/time";
import { markDraftCopiedAction, moveItemAction, openItemAction } from "./actions";
import { KindIcon } from "./card";

const selectClass =
  "min-h-9 w-full rounded-md border border-hairline bg-canvas px-2 text-body-sm text-ink focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60";

const REVIEW_LABEL: Record<string, string> = {
  APPROVED: "approved",
  CHANGES_REQUESTED: "requested changes",
  COMMENTED: "reviewed",
  DISMISSED: "review dismissed",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-hairline px-5 py-4">
      <h3 className="mb-3 text-caption font-medium uppercase tracking-wide text-stone">{title}</h3>
      {children}
    </section>
  );
}

function describeActivity(entry: ItemDetail["activity"][number]): string {
  const d = entry.detail;
  if (entry.action === "move") {
    const to = COLUMN_LABELS[d.to as BoardColumn] ?? String(d.to);
    return `moved to ${to}${d.reason && d.reason !== "moved on board" && d.reason !== "sync" ? ` — ${String(d.reason)}` : ""}`;
  }
  if (entry.action === "note") return "added a note";
  if (entry.action === "draft") return d.status === "copied" ? "copied the draft reply" : "wrote a draft reply";
  return entry.action;
}

export function Drawer({
  itemRef,
  onClose,
  onChanged,
}: {
  itemRef: string;
  onClose: () => void;
  onChanged: (item: ItemSummary) => void;
}) {
  const [item, setItem] = useState<ItemDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;
    setItem(null);
    setError(null);
    openItemAction(itemRef).then((result) => {
      if (cancelled) return;
      if ("error" in result) setError(result.error);
      else setItem(result.item);
    });
    return () => {
      cancelled = true;
    };
  }, [itemRef]);

  // Dialog behaviour: focus inside, Escape closes, page doesn't scroll behind, focus returns on close.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [onClose]);

  function update(column: BoardColumn, priority: Priority | null) {
    if (!item) return;
    startTransition(async () => {
      const result = await moveItemAction(item.ref, column, priority);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setError(null);
      setItem({ ...item, ...result.item });
      onChanged(result.item);
    });
  }

  async function copyAndOpen() {
    if (!item?.draft) return;
    await navigator.clipboard.writeText(item.draft.body);
    window.open(item.htmlUrl, "_blank", "noopener,noreferrer");
    setCopied(true);
    await markDraftCopiedAction(item.ref);
    onChanged({ ...item, hasDraft: false });
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div aria-hidden className="absolute inset-0 bg-ink/30" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        className="relative flex h-full w-full flex-col overflow-y-auto bg-canvas shadow-xl sm:max-w-2xl"
      >
        <header className="sticky top-0 z-10 flex items-start gap-3 border-b border-hairline bg-canvas px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-caption text-stone">
              {item ? <KindIcon item={item} /> : null}
              <span className="truncate font-mono">{itemRef}</span>
            </p>
            <h2 id="drawer-title" className="mt-1 text-heading-5 text-ink">
              {item?.title ?? (error ? "Couldn't load item" : "Loading…")}
            </h2>
          </div>
          {item ? (
            <a
              href={item.htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open on GitHub"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate hover:bg-surface hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
            >
              <ExternalLinkIcon />
            </a>
          ) : null}
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate hover:bg-surface hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
          >
            <CloseIcon />
          </button>
        </header>

        {error ? (
          <p role="alert" className="mx-5 mt-4 rounded-md bg-card-tint-rose px-3 py-2 text-body-sm text-semantic-error">
            {error}
          </p>
        ) : null}

        {item ? (
          <>
            <div className="grid grid-cols-2 gap-3 px-5 py-4">
              <label className="flex flex-col gap-1 text-caption text-slate">
                Column
                <select
                  value={item.column}
                  disabled={pending}
                  onChange={(e) => update(e.target.value as BoardColumn, item.priority)}
                  className={selectClass}
                >
                  {COLUMNS.map((c) => (
                    <option key={c} value={c}>
                      {COLUMN_LABELS[c]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-caption text-slate">
                Priority
                <select
                  value={item.priority ?? ""}
                  disabled={pending}
                  onChange={(e) => update(item.column, (e.target.value || null) as Priority | null)}
                  className={selectClass}
                >
                  <option value="">None</option>
                  <option value="p0">P0 — urgent</option>
                  <option value="p1">P1 — high</option>
                  <option value="p2">P2 — normal</option>
                  <option value="p3">P3 — low</option>
                </select>
              </label>
              <p className="col-span-2 text-caption text-stone">
                {item.author} opened {relativeTime(item.createdAt)} · updated {relativeTime(item.updatedAt)}
                {item.labels.length ? ` · ${item.labels.join(", ")}` : ""}
                {item.lastReason && item.lastReason !== "sync" && item.lastReason !== "moved on board"
                  ? ` · “${item.lastReason}”`
                  : ""}
              </p>
            </div>

            {item.draft ? (
              <Section title="Draft reply from Claude">
                <div className="rounded-md bg-card-tint-mint p-3">
                  <Markdown>{item.draft.body}</Markdown>
                </div>
                <button
                  type="button"
                  onClick={copyAndOpen}
                  className="mt-3 min-h-9 rounded-md bg-primary px-4 text-body-sm font-medium text-on-primary transition-colors duration-150 hover:bg-primary-pressed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {copied ? "Copied — paste it on GitHub" : "Copy & open on GitHub"}
                </button>
              </Section>
            ) : null}

            {item.notes.length ? (
              <Section title="Notes">
                <ul className="flex flex-col gap-3">
                  {item.notes.map((n) => (
                    <li key={n.id} className="rounded-md bg-card-tint-lavender p-3">
                      <p className="mb-1 text-micro text-slate">
                        {n.author === "claude" ? "Claude" : "You"} · {n.kind} · {relativeTime(n.createdAt)}
                      </p>
                      <Markdown>{n.body}</Markdown>
                    </li>
                  ))}
                </ul>
              </Section>
            ) : null}

            <Section title="Thread">
              <ol className="flex flex-col gap-4">
                <li>
                  <p className="mb-1 text-caption text-slate">
                    <span className="font-medium text-ink">{item.author}</span>
                    {isMaintainerRole(item.authorRole) ? <span className="ml-1.5 rounded-xs bg-card-tint-sky px-1 text-micro text-ink">maintainer</span> : null}
                    {" · "}
                    {relativeTime(item.createdAt)}
                  </p>
                  {item.body.trim() ? <Markdown>{item.body}</Markdown> : <p className="text-body-sm text-stone">No description.</p>}
                </li>
                {item.thread.map((c, i) => (
                  <li key={i} className="border-t border-hairline-soft pt-4">
                    <p className="mb-1 text-caption text-slate">
                      <span className="font-medium text-ink">{c.author}</span>
                      {isMaintainerRole(c.authorRole) ? (
                        <span className="ml-1.5 rounded-xs bg-card-tint-sky px-1 text-micro text-ink">maintainer</span>
                      ) : null}
                      {c.kind === "review" && c.reviewState ? ` ${REVIEW_LABEL[c.reviewState] ?? "reviewed"}` : ""}
                      {c.kind === "review_comment" ? " commented on code" : ""}
                      {" · "}
                      {relativeTime(c.createdAt)}
                    </p>
                    {c.body.trim() ? <Markdown>{c.body}</Markdown> : null}
                  </li>
                ))}
              </ol>
            </Section>

            {item.activity.length ? (
              <Section title="Activity">
                <ul className="flex flex-col gap-1.5">
                  {item.activity.map((a, i) => (
                    <li key={i} className="text-caption text-slate">
                      <span className="font-medium text-ink">
                        {a.actor === "claude" ? "Claude" : a.actor === "admin" ? "You" : "Sync"}
                      </span>{" "}
                      {describeActivity(a)} · {relativeTime(a.createdAt)}
                    </li>
                  ))}
                </ul>
              </Section>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
