import { describe, expect, test } from "bun:test";
import { extractMentions, mapIssue, mapPullRequest } from "./map";
import type { RawComment, RawIssue, RawPullRequest } from "./queries";

const OWNER = "souvikns";

function comment(id: string, login: string | null, role: string, createdAt: string, body = "ok"): RawComment {
  return { id, body, createdAt, authorAssociation: role, author: login ? { login } : null };
}

const issue: RawIssue = {
  id: "I_1",
  number: 12,
  title: "CLI crashes",
  body: "Steps... cc @souvikns and @derberg, not `@code` or foo@bar.com",
  state: "OPEN",
  url: "https://github.com/asyncapi/cli/issues/12",
  createdAt: "2026-11-01T00:00:00Z",
  updatedAt: "2026-11-03T00:00:00Z",
  closedAt: null,
  authorAssociation: "NONE",
  author: { login: "reporter" },
  labels: { nodes: [{ name: "bug", color: "d73a4a" }] },
  reactions: { totalCount: 3 },
  comments: {
    totalCount: 2,
    nodes: [
      comment("C_1", "derberg", "MEMBER", "2026-11-02T00:00:00Z", "Looking"),
      comment("C_2", "reporter", "NONE", "2026-11-03T00:00:00Z", "Any update @souvikns?"),
    ],
  },
};

describe("extractMentions", () => {
  test("finds @logins, skipping code, emails, teams, duplicates", () => {
    expect(
      extractMentions("hi @a-b and @A-B, `@code`, ```\n@block\n```, me@mail.com, @org/team, (@paren)"),
    ).toEqual(["a-b", "paren"]);
  });
});

describe("mapIssue", () => {
  const mapped = mapIssue(issue, 7, OWNER);

  test("maps item fields", () => {
    expect(mapped.item).toMatchObject({
      id: "I_1",
      repoId: 7,
      kind: "issue",
      number: 12,
      state: "open",
      author: "reporter",
      authorRole: "NONE",
      labels: [{ name: "bug", color: "d73a4a" }],
      commentsCount: 2,
      reactionsCount: 3,
      htmlUrl: "https://github.com/asyncapi/cli/issues/12",
      lastCommentBy: "reporter",
      lastCommentIsMaintainer: false,
      isDraft: false,
      requestedReviewers: [],
    });
    expect(mapped.item.updatedAt).toEqual(new Date("2026-11-03T00:00:00Z"));
    expect(mapped.item.lastCommentAt).toEqual(new Date("2026-11-03T00:00:00Z"));
  });

  test("maps comments", () => {
    expect(mapped.comments.map((c) => [c.id, c.kind, c.author])).toEqual([
      ["C_1", "comment", "derberg"],
      ["C_2", "comment", "reporter"],
    ]);
  });

  test("records maintainer mentions with answered state", () => {
    const summary = mapped.mentions.map((m) => [m.commentId, m.login, m.isOwner, m.answered]);
    expect(summary).toEqual([
      [null, "souvikns", true, true], // body mention; derberg (MEMBER) commented later
      [null, "derberg", false, true],
      ["C_2", "souvikns", true, false], // nobody from the team after C_2
    ]);
  });

  test("ghost authors become 'ghost'", () => {
    expect(mapIssue({ ...issue, author: null }, 7, OWNER).item.author).toBe("ghost");
  });
});

describe("mapPullRequest", () => {
  const pr: RawPullRequest = {
    ...issue,
    id: "PR_1",
    number: 40,
    body: "Fixes #12",
    state: "MERGED",
    mergedAt: "2026-11-05T00:00:00Z",
    closedAt: "2026-11-05T00:00:00Z",
    isDraft: false,
    reviewDecision: "APPROVED",
    comments: { totalCount: 0, nodes: [] },
    reviews: {
      nodes: [
        {
          id: "R_1",
          state: "APPROVED",
          body: "LGTM",
          createdAt: "2026-11-04T00:00:00Z",
          authorAssociation: "MEMBER",
          author: { login: "derberg" },
          comments: { nodes: [comment("RC_1", "derberg", "MEMBER", "2026-11-04T00:00:00Z", "nit")] },
        },
      ],
    },
    reviewRequests: { nodes: [{ requestedReviewer: { login: "souvikns" } }, { requestedReviewer: { slug: "core" } }] },
  };
  const mapped = mapPullRequest(pr, 7, OWNER);

  test("maps PR fields", () => {
    expect(mapped.item).toMatchObject({
      kind: "pr",
      state: "merged",
      reviewDecision: "APPROVED",
      requestedReviewers: ["souvikns", "team:core"],
      lastCommentBy: "derberg",
      lastCommentIsMaintainer: true,
    });
    expect(mapped.item.mergedAt).toEqual(new Date("2026-11-05T00:00:00Z"));
  });

  test("includes reviews and review comments", () => {
    expect(mapped.comments.map((c) => [c.id, c.kind, c.reviewState])).toEqual([
      ["R_1", "review", "APPROVED"],
      ["RC_1", "review_comment", null],
    ]);
  });
});
