import { describe, expect, test } from "bun:test";
import { focusScore, needsAssessment, quadrant, rankFocus, waitingScore } from "./focus";
import { assessment, summary } from "./triage/fixtures";

const OWNER = "Souvikns";
const NOW = Date.parse("2026-11-28T00:00:00Z");
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();

describe("needsAssessment", () => {
  test("missing or stale assessments need work", () => {
    expect(needsAssessment(summary(), null)).toBe(true);
    expect(needsAssessment(summary({ updatedAt: daysAgo(1) }), assessment({ itemUpdatedAt: daysAgo(1) }))).toBe(false);
    expect(needsAssessment(summary({ updatedAt: daysAgo(1) }), assessment({ itemUpdatedAt: daysAgo(3) }))).toBe(true);
  });
});

describe("waitingScore", () => {
  test("0 when a maintainer spoke last or the item is closed", () => {
    expect(waitingScore(summary({ lastCommentBy: "m", lastCommentIsMaintainer: true, lastCommentAt: daysAgo(30) }), OWNER, NOW)).toBe(0);
    expect(waitingScore(summary({ state: "closed", createdAt: daysAgo(30) }), OWNER, NOW)).toBe(0);
  });

  test("buckets days since a non-maintainer spoke", () => {
    expect(waitingScore(summary({ createdAt: daysAgo(1) }), OWNER, NOW)).toBe(0);
    expect(waitingScore(summary({ createdAt: daysAgo(3) }), OWNER, NOW)).toBe(1);
    expect(waitingScore(summary({ lastCommentBy: "x", lastCommentAt: daysAgo(10) }), OWNER, NOW)).toBe(2);
    expect(waitingScore(summary({ createdAt: daysAgo(20) }), OWNER, NOW)).toBe(3);
  });
});

describe("focusScore", () => {
  test("weights ease > impact > unblocks > waiting", () => {
    expect(focusScore(assessment({ effort: "xs", impact: "high", unblocksOthers: true }), 3)).toBe(4 * 3 + 3 * 3 + 2 + 3);
    expect(focusScore(assessment({ effort: "l", impact: "low" }), 0)).toBe(3);
  });
});

describe("quadrant", () => {
  test("maps effort and impact", () => {
    expect(quadrant(assessment({ effort: "xs", impact: "high" }))).toBe("quick_wins");
    expect(quadrant(assessment({ effort: "s", impact: "med" }))).toBe("quick_wins");
    expect(quadrant(assessment({ effort: "m", impact: "high" }))).toBe("big_bets");
    expect(quadrant(assessment({ effort: "xs", impact: "low" }))).toBe("fill_ins");
    expect(quadrant(assessment({ effort: "l", impact: "low" }))).toBe("ignore");
  });
});

describe("rankFocus", () => {
  test("ranks open assessed items by score, then newest; splits out unassessed", () => {
    const quick = summary({ ref: "a/b#1", assessment: assessment({ effort: "xs", impact: "high" }), needsAssessment: false });
    const slow = summary({ ref: "a/b#2", assessment: assessment({ effort: "l", impact: "med" }), needsAssessment: false });
    const tieNewer = summary({ ref: "a/b#3", updatedAt: daysAgo(0), assessment: assessment({ effort: "l", impact: "med" }), needsAssessment: false });
    const closed = summary({ ref: "a/b#4", state: "closed", assessment: assessment(), needsAssessment: false });
    const fresh = summary({ ref: "a/b#5", assessment: null, needsAssessment: true });
    const { ranked, unassessed } = rankFocus([slow, closed, fresh, quick, tieNewer], OWNER, NOW);
    expect(ranked.map((r) => r.item.ref)).toEqual(["a/b#1", "a/b#3", "a/b#2"]);
    expect(ranked[0]?.quadrant).toBe("quick_wins");
    expect(unassessed.map((i) => i.ref)).toEqual(["a/b#5"]);
  });
});
