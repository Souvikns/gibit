import { describe, expect, test } from "bun:test";
import { relativeTime } from "./time";

const NOW = Date.parse("2026-08-02T12:00:00Z");

describe("relativeTime", () => {
  test("formats each relative time bucket", () => {
    expect(relativeTime(new Date(NOW - 30_000).toISOString(), NOW)).toBe("just now");
    expect(relativeTime(new Date(NOW - 5 * 60_000).toISOString(), NOW)).toBe("5m ago");
    expect(relativeTime(new Date(NOW - 2 * 60 * 60_000).toISOString(), NOW)).toBe("2h ago");
    expect(relativeTime(new Date(NOW - 3 * 24 * 60 * 60_000).toISOString(), NOW)).toBe("3d ago");
    expect(relativeTime(new Date(NOW - 2 * 30 * 24 * 60 * 60_000).toISOString(), NOW)).toBe("2mo ago");
    expect(relativeTime(new Date(NOW - 2 * 365 * 24 * 60 * 60_000).toISOString(), NOW)).toBe("2y ago");
  });

  test("does not report future dates as negative time", () => {
    expect(relativeTime(new Date(NOW + 60_000).toISOString(), NOW)).toBe("just now");
  });
});
