import type { BoardColumn, ItemState } from "@/lib/model";

/** The only column changes sync makes; every judgment move is Claude's or the owner's. */
export function mechanicalMove(current: BoardColumn | null, state: ItemState): BoardColumn | null {
  const closed = state !== "open";
  if (current === null) return closed ? "done" : "inbox";
  if (closed) return current === "done" ? null : "done";
  return current === "done" ? "inbox" : null;
}
