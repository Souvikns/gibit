import { describe, expect, test } from "bun:test";
import { safeEqual, safeNextPath, shouldRenew, signSession, verifySession } from "./session";

const NOW = 1_800_000_000_000;
const DAY = 86_400_000;

describe("sessions", () => {
  test("a signed session verifies with the same password", async () => {
    const token = await signSession("pw", NOW + DAY);
    expect(await verifySession("pw", token, NOW)).toEqual({ valid: true, expiresAt: NOW + DAY });
  });

  test("changing the password invalidates sessions", async () => {
    const token = await signSession("pw", NOW + DAY);
    expect((await verifySession("other", token, NOW)).valid).toBe(false);
  });

  test("tampered expiry is rejected", async () => {
    const token = await signSession("pw", NOW + DAY);
    const [, sig] = token.split(".");
    expect((await verifySession("pw", `${NOW + 99 * DAY}.${sig}`, NOW)).valid).toBe(false);
  });

  test("expired and malformed tokens are rejected", async () => {
    expect((await verifySession("pw", await signSession("pw", NOW - 1), NOW)).valid).toBe(false);
    expect((await verifySession("pw", "garbage", NOW)).valid).toBe(false);
    expect((await verifySession("pw", "123.!!!", NOW)).valid).toBe(false);
  });

  test("renews when under 15 days remain", () => {
    expect(shouldRenew(NOW + 20 * DAY, NOW)).toBe(false);
    expect(shouldRenew(NOW + 10 * DAY, NOW)).toBe(true);
  });
});

test("safeEqual compares contents", async () => {
  expect(await safeEqual("abc", "abc")).toBe(true);
  expect(await safeEqual("abc", "abd")).toBe(false);
  expect(await safeEqual("abc", "abcd")).toBe(false);
});

test("safeNextPath only allows local paths", () => {
  expect(safeNextPath("/settings")).toBe("/settings");
  expect(safeNextPath("/board?item=1")).toBe("/board?item=1");
  expect(safeNextPath("//evil.com")).toBe("/");
  expect(safeNextPath("https://evil.com")).toBe("/");
  expect(safeNextPath("/\\evil.com")).toBe("/");
  expect(safeNextPath(null)).toBe("/");
});
