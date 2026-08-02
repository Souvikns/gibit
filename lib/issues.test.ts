import { describe, expect, test } from "bun:test";
import {
  deriveRepos,
  filterIssues,
  labelTint,
  pageNumbers,
  sortIssues,
  type IssueItem,
} from "./issues";

const issues: IssueItem[] = [
  {
    id: 1,
    number: 1,
    title: "Fix login button",
    state: "open",
    url: "https://github.com/acme/web/issues/1",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-03T00:00:00Z",
    comments: 4,
    author: "ada",
    authorAvatar: "",
    repo: "web",
    labels: [{ name: "bug", color: "ff0000" }],
  },
  {
    id: 2,
    number: 2,
    title: "Write documentation",
    state: "closed",
    url: "https://github.com/acme/docs/issues/2",
    createdAt: "2026-02-01T00:00:00Z",
    updatedAt: "2026-02-02T00:00:00Z",
    comments: 9,
    author: "grace",
    authorAvatar: "",
    repo: "docs",
    labels: [{ name: "help wanted", color: "00ff00" }],
  },
];

describe("filterIssues", () => {
  test("filters by state, repo, and searchable text", () => {
    expect(filterIssues(issues, { state: "open", repo: "all", query: "" })).toHaveLength(1);
    expect(filterIssues(issues, { state: "all", repo: "docs", query: "" })[0]?.id).toBe(2);
    expect(filterIssues(issues, { state: "all", repo: "all", query: "HELP WANTED" })[0]?.id).toBe(2);
  });
});

describe("sortIssues", () => {
  test("sorts by creation, update, and comment count", () => {
    expect(sortIssues(issues, "newest")[0]?.id).toBe(2);
    expect(sortIssues(issues, "oldest")[0]?.id).toBe(1);
    expect(sortIssues(issues, "updated")[0]?.id).toBe(2);
    expect(sortIssues(issues, "comments")[0]?.id).toBe(2);
  });
});

test("deriveRepos orders repositories by issue count then name", () => {
  expect(deriveRepos([...issues, { ...issues[0]!, id: 3 }])).toEqual(["web", "docs"]);
});

test("pageNumbers includes a compact window for long lists", () => {
  expect(pageNumbers(5, 10)).toEqual([1, "ellipsis", 4, 5, 6, "ellipsis", 10]);
});

test("labelTint is deterministic", () => {
  expect(labelTint("bug")).toEqual(labelTint("bug"));
  expect(labelTint("bug").chip).toContain("bg-card-tint-");
});
