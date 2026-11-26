import { expect, test } from "bun:test";
import { summary } from "./fixtures";
import { isReviewRequested, lastSpeakerIsTeam, needsReply } from "./signals";

const OWNER = "Souvikns";

test("with no comments, the author is the last speaker", () => {
  expect(lastSpeakerIsTeam(summary({ authorRole: "NONE" }), OWNER)).toBe(false);
  expect(lastSpeakerIsTeam(summary({ authorRole: "MEMBER" }), OWNER)).toBe(true);
  expect(lastSpeakerIsTeam(summary({ author: "souvikns" }), OWNER)).toBe(true);
});

test("with comments, the last commenter decides", () => {
  expect(lastSpeakerIsTeam(summary({ lastCommentBy: "x", lastCommentIsMaintainer: true }), OWNER)).toBe(true);
  expect(lastSpeakerIsTeam(summary({ authorRole: "MEMBER", lastCommentBy: "x", lastCommentIsMaintainer: false }), OWNER)).toBe(false);
});

test("needsReply only for open items where a non-maintainer spoke last", () => {
  expect(needsReply(summary(), OWNER)).toBe(true);
  expect(needsReply(summary({ state: "closed" }), OWNER)).toBe(false);
  expect(needsReply(summary({ lastCommentBy: "m", lastCommentIsMaintainer: true }), OWNER)).toBe(false);
});

test("isReviewRequested matches open PRs requesting the owner, case-insensitively", () => {
  expect(isReviewRequested(summary({ kind: "pr", requestedReviewers: ["souvikns"] }), OWNER)).toBe(true);
  expect(isReviewRequested(summary({ kind: "pr", requestedReviewers: ["team:core"] }), OWNER)).toBe(false);
  expect(isReviewRequested(summary({ kind: "pr", state: "merged", requestedReviewers: ["Souvikns"] }), OWNER)).toBe(false);
  expect(isReviewRequested(summary({ kind: "issue", requestedReviewers: ["Souvikns"] }), OWNER)).toBe(false);
});
