import { inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { activityLog, comments, items, mentions, triage } from "@/lib/db/schema";
import { excludedSet } from "@/lib/db/upsert";
import type { MappedItem } from "@/lib/github/map";
import { mechanicalMove } from "./rules";

/** Persist one fetched page. Idempotent: re-storing the same page changes nothing. */
export async function storePage(page: MappedItem[]): Promise<{ items: number; comments: number }> {
  if (page.length === 0) return { items: 0, comments: 0 };
  const ids = page.map((m) => m.item.id);
  const commentRows = page.flatMap((m) => m.comments);
  const mentionRows = page.flatMap((m) => m.mentions);

  await db()
    .insert(items)
    .values(page.map((m) => m.item))
    .onConflictDoUpdate({ target: items.id, set: excludedSet(items, ["id"]) });

  if (commentRows.length > 0) {
    await db()
      .insert(comments)
      .values(commentRows)
      .onConflictDoUpdate({ target: comments.id, set: excludedSet(comments, ["id"]) });
  }

  await db().delete(mentions).where(inArray(mentions.itemId, ids));
  if (mentionRows.length > 0) await db().insert(mentions).values(mentionRows);

  const existing = new Map(
    (
      await db()
        .select({ itemId: triage.itemId, column: triage.column })
        .from(triage)
        .where(inArray(triage.itemId, ids))
    ).map((t) => [t.itemId, t.column]),
  );
  const now = new Date();
  const moves = page.flatMap((m) => {
    const from = existing.get(m.item.id) ?? null;
    const to = mechanicalMove(from, m.item.state);
    return to ? [{ itemId: m.item.id, from, to }] : [];
  });
  if (moves.length > 0) {
    await db()
      .insert(triage)
      .values(moves.map((mv) => ({ itemId: mv.itemId, column: mv.to, lastReason: "sync", updatedAt: now })))
      .onConflictDoUpdate({ target: triage.itemId, set: excludedSet(triage, ["itemId", "priority", "seenAt"]) });
    await db()
      .insert(activityLog)
      .values(
        moves.map((mv) => ({
          itemId: mv.itemId,
          actor: "sync" as const,
          action: "move" as const,
          detail: { from: mv.from, to: mv.to, reason: "sync" },
        })),
      );
  }

  return { items: page.length, comments: commentRows.length };
}
