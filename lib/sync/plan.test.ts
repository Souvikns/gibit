import { describe, expect, test } from "bun:test";
import type { RepoSyncState } from "@/lib/model";
import { advanceRepoState, BACKFILL_DAYS, initialRepoState } from "./plan";

const NOW = Date.parse("2026-11-26T00:00:00Z");
const BACKFILL_SINCE = new Date(NOW - BACKFILL_DAYS * 86_400_000).toISOString();
const LAST_PAGE = { hasNextPage: false, endCursor: null, reachedSince: false, maxUpdatedAt: null };

function step(state: RepoSyncState | "done"): RepoSyncState {
  if (state === "done") throw new Error("unexpected done");
  return advanceRepoState(state, LAST_PAGE) as RepoSyncState;
}

describe("initialRepoState", () => {
  test("unbackfilled repo starts backfill with a 90-day window", () => {
    expect(initialRepoState({ syncCursor: null, backfilledAt: null }, NOW)).toEqual({
      backfill: true,
      phase: "issues-open",
      after: null,
      since: BACKFILL_SINCE,
      maxUpdatedAt: null,
    });
  });

  test("backfilled repo syncs incrementally from its cursor", () => {
    const cursor = new Date("2026-11-20T00:00:00Z");
    expect(initialRepoState({ syncCursor: cursor, backfilledAt: cursor }, NOW)).toEqual({
      backfill: false,
      phase: "issues-since",
      after: null,
      since: cursor.toISOString(),
      maxUpdatedAt: cursor.toISOString(),
    });
  });
});

describe("advanceRepoState", () => {
  const base = initialRepoState({ syncCursor: null, backfilledAt: null }, NOW);

  test("next page stays in phase and keeps the max updatedAt", () => {
    const next = advanceRepoState(
      { ...base, maxUpdatedAt: "2026-11-25T00:00:00Z" },
      { hasNextPage: true, endCursor: "abc", reachedSince: false, maxUpdatedAt: "2026-11-24T00:00:00Z" },
    );
    expect(next).toEqual({ ...base, after: "abc", maxUpdatedAt: "2026-11-25T00:00:00Z" });
  });

  test("backfill walks issues-open → issues-since → prs-open → prs-recent → done", () => {
    const s1 = step(base);
    expect(s1).toMatchObject({ phase: "issues-since", after: null });
    const s2 = step(s1);
    expect(s2).toMatchObject({ phase: "prs-open" });
    const s3 = step(s2);
    expect(s3).toMatchObject({ phase: "prs-recent" });
    expect(advanceRepoState(s3, LAST_PAGE)).toBe("done");
  });

  test("incremental walks issues-since → prs-recent → done", () => {
    const inc = initialRepoState({ syncCursor: new Date(NOW), backfilledAt: new Date(NOW) }, NOW);
    const s1 = step(inc);
    expect(s1).toMatchObject({ phase: "prs-recent" });
    expect(advanceRepoState(s1, LAST_PAGE)).toBe("done");
  });

  test("prs-recent stops early once it passes the since bound", () => {
    const state = { ...base, phase: "prs-recent" as const };
    expect(
      advanceRepoState(state, { hasNextPage: true, endCursor: "x", reachedSince: true, maxUpdatedAt: null }),
    ).toBe("done");
  });
});
