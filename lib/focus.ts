import type { Effort, Impact, NextAction } from "@/lib/model";
import { needsReply } from "@/lib/triage/signals";
import type { Assessment, ItemSummary } from "@/lib/triage/types";

export type Quadrant = "quick_wins" | "big_bets" | "fill_ins" | "ignore";

export const QUADRANTS: Quadrant[] = ["quick_wins", "big_bets", "fill_ins", "ignore"];

export const QUADRANT_LABELS: Record<Quadrant, string> = {
  quick_wins: "Quick wins",
  big_bets: "Big bets",
  fill_ins: "Fill-ins",
  ignore: "Ignore for now",
};

export const NEXT_ACTION_LABELS: Record<NextAction, string> = {
  fix: "Fix",
  unblock: "Unblock",
  review: "Review",
  reply: "Reply",
  decide: "Decide",
  close: "Close",
  wait: "Wait",
};

export const EFFORT_LABELS: Record<Effort, string> = { xs: "XS", s: "S", m: "M", l: "L" };
export const IMPACT_LABELS: Record<Impact, string> = { low: "low impact", med: "med impact", high: "high impact" };

const EASE: Record<Effort, number> = { xs: 3, s: 2, m: 1, l: 0 };
const IMPACT: Record<Impact, number> = { high: 3, med: 2, low: 1 };
const DAY_MS = 86_400_000;

/** No assessment yet, or the item changed on GitHub since Claude (or the owner) assessed it. */
export function needsAssessment(item: Pick<ItemSummary, "updatedAt">, assessment: Pick<Assessment, "itemUpdatedAt"> | null): boolean {
  return !assessment || item.updatedAt > assessment.itemUpdatedAt;
}

/** 0–3 by how long a non-maintainer has been waiting for the team to respond. */
export function waitingScore(item: ItemSummary, owner: string, now: number): number {
  if (!needsReply(item, owner)) return 0;
  const since = Date.parse(item.lastCommentAt ?? item.createdAt);
  const days = (now - since) / DAY_MS;
  if (days < 2) return 0;
  if (days < 5) return 1;
  if (days < 14) return 2;
  return 3;
}

export function focusScore(assessment: Pick<Assessment, "effort" | "impact" | "unblocksOthers">, waiting: number): number {
  return 4 * EASE[assessment.effort] + 3 * IMPACT[assessment.impact] + 2 * (assessment.unblocksOthers ? 1 : 0) + waiting;
}

export function quadrant(assessment: Pick<Assessment, "effort" | "impact">): Quadrant {
  const important = assessment.impact !== "low";
  const easy = assessment.effort === "xs" || assessment.effort === "s";
  if (important) return easy ? "quick_wins" : "big_bets";
  return easy ? "fill_ins" : "ignore";
}

export interface RankedItem {
  item: ItemSummary;
  assessment: Assessment;
  score: number;
  quadrant: Quadrant;
  waiting: number;
}

/** Open items only. Assessed ones ranked by score (ties: newest activity); unassessed returned separately. */
export function rankFocus(items: ItemSummary[], owner: string, now: number): { ranked: RankedItem[]; unassessed: ItemSummary[] } {
  const ranked: RankedItem[] = [];
  const unassessed: ItemSummary[] = [];
  for (const item of items) {
    if (item.state !== "open") continue;
    if (!item.assessment) {
      unassessed.push(item);
      continue;
    }
    const waiting = waitingScore(item, owner, now);
    ranked.push({
      item,
      assessment: item.assessment,
      score: focusScore(item.assessment, waiting),
      quadrant: quadrant(item.assessment),
      waiting,
    });
  }
  ranked.sort((a, b) => b.score - a.score || b.item.updatedAt.localeCompare(a.item.updatedAt));
  unassessed.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return { ranked, unassessed };
}
