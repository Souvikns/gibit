import type { Assessment, ItemSummary } from "./types";

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
    seenAt: null,
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
    assessment: null,
    needsAssessment: true,
    ...overrides,
  };
}

/** Test helper: a complete Assessment with overridable fields. */
export function assessment(overrides: Partial<Assessment> = {}): Assessment {
  return {
    summary: "Something to do",
    nextAction: "fix",
    effort: "s",
    impact: "med",
    unblocksOthers: false,
    blockedBy: null,
    whyNow: null,
    confidence: "med",
    assessedBy: "claude",
    itemUpdatedAt: "2026-11-01T00:00:00.000Z",
    assessedAt: "2026-11-01T00:00:00.000Z",
    ...overrides,
  };
}
