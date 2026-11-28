import { describe, expect, test } from "bun:test";
import { selectBriefing } from "./briefing";
import { summary } from "./fixtures";

const OWNER = "Souvikns";
const SINCE = new Date("2026-11-20T00:00:00Z");
const OLD = "2026-11-10T00:00:00.000Z";
const NEW = "2026-11-21T00:00:00.000Z";

describe("selectBriefing", () => {
  const items = [
    summary({ ref: "a/b#1", createdAt: NEW, updatedAt: NEW }), // new + needs reply
    summary({ ref: "a/b#2", createdAt: OLD, updatedAt: OLD }), // needs reply but no activity since
    summary({ ref: "a/b#3", kind: "pr", createdAt: OLD, updatedAt: OLD, requestedReviewers: ["souvikns"], lastCommentBy: "m", lastCommentIsMaintainer: true }),
    summary({ ref: "a/b#4", kind: "pr", createdAt: OLD, updatedAt: OLD, reviewDecision: "APPROVED", authorRole: "MEMBER", column: "ready" }),
    summary({ ref: "a/b#5", createdAt: OLD, updatedAt: OLD, unansweredOwnerMention: true, authorRole: "MEMBER" }),
    summary({ ref: "a/b#6", state: "closed", createdAt: OLD, updatedAt: NEW, column: "done", unansweredOwnerMention: true }),
  ];
  const b = selectBriefing({ items, changes: [], since: SINCE, owner: OWNER, lastSyncAt: null });
  const refs = (section: { items: { ref: string }[] }) => section.items.map((i) => i.ref);

  test("categorises items", () => {
    expect(refs(b.newItems)).toEqual(["a/b#1"]);
    expect(refs(b.needsReply)).toEqual(["a/b#1"]);
    expect(refs(b.reviewRequested)).toEqual(["a/b#3"]);
    expect(refs(b.approvedNotMerged)).toEqual(["a/b#4"]);
    expect(refs(b.unansweredMentions)).toEqual(["a/b#5"]);
  });

  test("counts items needing assessment and ranks the focus top", () => {
    expect(b.needsAssessment).toBe(5); // all open fixtures are unassessed
    expect(b.focusTop).toEqual([]);
  });

  test("counts columns and records since", () => {
    expect(b.columnCounts).toEqual({ inbox: 4, ready: 1, done: 1 });
    expect(b.since).toBe(SINCE.toISOString());
  });

  test("caps sections at 25 but reports the total", () => {
    const many = Array.from({ length: 30 }, (_, i) => summary({ ref: `a/b#${i + 10}`, createdAt: NEW, updatedAt: NEW }));
    const big = selectBriefing({ items: many, changes: [], since: SINCE, owner: OWNER, lastSyncAt: null });
    expect(big.newItems.total).toBe(30);
    expect(big.newItems.items).toHaveLength(25);
  });
});
