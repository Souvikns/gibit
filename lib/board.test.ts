import { describe, expect, test } from "bun:test";
import { deriveRepoOptions, filterBoard, groupByColumn, isUnseen } from "./board";
import { summary } from "./triage/fixtures";

describe("isUnseen", () => {
  test("never seen or updated after seen", () => {
    expect(isUnseen(summary({ seenAt: null }))).toBe(true);
    expect(isUnseen(summary({ updatedAt: "2026-11-02T00:00:00.000Z", seenAt: "2026-11-01T00:00:00.000Z" }))).toBe(true);
    expect(isUnseen(summary({ updatedAt: "2026-11-01T00:00:00.000Z", seenAt: "2026-11-02T00:00:00.000Z" }))).toBe(false);
  });
});

describe("filterBoard", () => {
  const items = [
    summary({ ref: "a/x#1", repo: "a/x", kind: "issue", priority: "p1" }),
    summary({ ref: "a/y#2", repo: "a/y", kind: "pr", priority: null }),
  ];
  test("filters by repo, kind, priority", () => {
    expect(filterBoard(items, {}).length).toBe(2);
    expect(filterBoard(items, { repo: "a/y" }).map((i) => i.ref)).toEqual(["a/y#2"]);
    expect(filterBoard(items, { kind: "issue" }).map((i) => i.ref)).toEqual(["a/x#1"]);
    expect(filterBoard(items, { priority: "p1" }).map((i) => i.ref)).toEqual(["a/x#1"]);
  });
});

describe("groupByColumn", () => {
  test("groups into every column, priority first then newest", () => {
    const grouped = groupByColumn([
      summary({ ref: "a/b#1", column: "inbox", updatedAt: "2026-11-01T00:00:00.000Z" }),
      summary({ ref: "a/b#2", column: "inbox", updatedAt: "2026-11-03T00:00:00.000Z" }),
      summary({ ref: "a/b#3", column: "inbox", priority: "p2", updatedAt: "2026-10-01T00:00:00.000Z" }),
      summary({ ref: "a/b#4", column: "inbox", priority: "p0", updatedAt: "2026-09-01T00:00:00.000Z" }),
      summary({ ref: "a/b#5", column: "ready" }),
    ]);
    expect(grouped.inbox.map((i) => i.ref)).toEqual(["a/b#4", "a/b#3", "a/b#2", "a/b#1"]);
    expect(grouped.ready.map((i) => i.ref)).toEqual(["a/b#5"]);
    expect(grouped.done).toEqual([]);
    expect(Object.keys(grouped)).toHaveLength(7);
  });
});

test("deriveRepoOptions lists unique repos alphabetically", () => {
  expect(deriveRepoOptions([summary({ repo: "b/z" }), summary({ repo: "a/y" }), summary({ repo: "b/z" })])).toEqual(["a/y", "b/z"]);
});
