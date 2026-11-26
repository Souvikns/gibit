import { expect, test } from "bun:test";
import { COLUMNS, isMaintainerRole } from "./model";

test("board columns are in display order", () => {
  expect(COLUMNS).toEqual(["inbox", "needs_reply", "needs_review", "investigating", "waiting", "ready", "done"]);
});

test("isMaintainerRole accepts OWNER, MEMBER, COLLABORATOR only", () => {
  expect(isMaintainerRole("OWNER")).toBe(true);
  expect(isMaintainerRole("MEMBER")).toBe(true);
  expect(isMaintainerRole("COLLABORATOR")).toBe(true);
  expect(isMaintainerRole("CONTRIBUTOR")).toBe(false);
  expect(isMaintainerRole("NONE")).toBe(false);
});
