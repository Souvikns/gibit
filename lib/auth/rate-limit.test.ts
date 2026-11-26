import { expect, test } from "bun:test";
import { isBlocked, LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS, recordFailure, type AttemptRecord } from "./rate-limit";

const NOW = 1_800_000_000_000;

test("no record is not blocked", () => {
  expect(isBlocked(null, NOW)).toEqual({ blocked: false, retryAfterMs: 0 });
});

test("blocks after max failures within the window", () => {
  let rec: AttemptRecord | null = null;
  for (let i = 0; i < LOGIN_MAX_ATTEMPTS; i++) rec = recordFailure(rec, NOW);
  expect(rec).toEqual({ count: LOGIN_MAX_ATTEMPTS, windowStart: NOW });
  expect(isBlocked(rec, NOW + 1000)).toEqual({ blocked: true, retryAfterMs: LOGIN_WINDOW_MS - 1000 });
});

test("window expiry resets the count", () => {
  const rec = { count: LOGIN_MAX_ATTEMPTS, windowStart: NOW };
  expect(isBlocked(rec, NOW + LOGIN_WINDOW_MS).blocked).toBe(false);
  expect(recordFailure(rec, NOW + LOGIN_WINDOW_MS)).toEqual({ count: 1, windowStart: NOW + LOGIN_WINDOW_MS });
});
