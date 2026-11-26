"use server";

import { requireSession } from "@/lib/auth/server";
import type { BoardColumn, Priority } from "@/lib/model";
import { getItem, markDraftCopied, markSeen, moveItem } from "@/lib/triage/service";
import type { ItemDetail, ItemSummary } from "@/lib/triage/types";

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

export async function moveItemAction(
  ref: string,
  column: BoardColumn,
  priority?: Priority | null,
): Promise<{ item: ItemSummary } | { error: string }> {
  await requireSession();
  try {
    return { item: await moveItem({ ref, column, priority, reason: "moved on board", actor: "admin" }) };
  } catch (error) {
    return { error: message(error) };
  }
}

export async function openItemAction(ref: string): Promise<{ item: ItemDetail } | { error: string }> {
  await requireSession();
  try {
    await markSeen(ref);
    return { item: await getItem(ref) };
  } catch (error) {
    return { error: message(error) };
  }
}

export async function markDraftCopiedAction(ref: string): Promise<void> {
  await requireSession();
  await markDraftCopied(ref);
}
