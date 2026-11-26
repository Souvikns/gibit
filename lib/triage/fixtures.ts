import type { ItemSummary } from "./types";

/** Test helper: a complete ItemSummary with overridable fields. */
export function summary(overrides: Partial<ItemSummary> = {}): ItemSummary {
  return {
    ref: "asyncapi/cli#1",
    repo: "asyncapi/cli",
    number: 1,
    kind: "issue",
    title: "Something",
    state: "open",
    author: "reporter",
    authorRole: "NONE",
    column: "inbox",
    priority: null,
    lastReason: null,
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
    lastCommentBy: null,
    lastCommentAt: null,
    lastCommentIsMaintainer: false,
    isDraft: false,
    reviewDecision: null,
    requestedReviewers: [],
    labels: [],
    htmlUrl: "https://github.com/asyncapi/cli/issues/1",
    hasDraft: false,
    unansweredOwnerMention: false,
    unansweredMaintainerMention: false,
    ...overrides,
  };
}
