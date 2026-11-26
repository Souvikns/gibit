import { expect, test } from "bun:test";
import { mechanicalMove } from "./rules";

test("new items land in inbox, or done if already closed", () => {
  expect(mechanicalMove(null, "open")).toBe("inbox");
  expect(mechanicalMove(null, "closed")).toBe("done");
  expect(mechanicalMove(null, "merged")).toBe("done");
});

test("closed or merged items move to done", () => {
  expect(mechanicalMove("waiting", "closed")).toBe("done");
  expect(mechanicalMove("ready", "merged")).toBe("done");
  expect(mechanicalMove("done", "closed")).toBeNull();
});

test("reopened items go back to inbox", () => {
  expect(mechanicalMove("done", "open")).toBe("inbox");
});

test("open items elsewhere are left alone", () => {
  expect(mechanicalMove("needs_reply", "open")).toBeNull();
  expect(mechanicalMove("inbox", "open")).toBeNull();
});
