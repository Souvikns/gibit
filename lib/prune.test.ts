import { expect, test } from "bun:test";
import { cutoff, DEFAULT_RETENTION } from "./prune";

test("cutoff subtracts whole days", () => {
  const now = Date.parse("2026-11-28T00:00:00Z");
  expect(cutoff(30, now).toISOString()).toBe("2026-10-29T00:00:00.000Z");
});

test("defaults match the agreed retention", () => {
  expect(DEFAULT_RETENTION).toEqual({
    doneDays: 30,
    syncActivityDays: 14,
    activityDays: 90,
    usedDraftDays: 30,
    keepReports: 60,
    keepSyncRuns: 50,
  });
});
