import type { RateLimit } from "./graphql";

export const VIEWER_QUERY = `query { viewer { login } }`;

export const REPO_QUERY = `
query Repo($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    name
    owner { login }
    isPrivate
    isArchived
    defaultBranchRef { name }
  }
}`;

export interface RepoQueryResult {
  repository: {
    name: string;
    owner: { login: string };
    isPrivate: boolean;
    isArchived: boolean;
    defaultBranchRef: { name: string } | null;
  } | null;
}

export const OWNER_REPOS_QUERY = `
query OwnerRepos($login: String!, $after: String) {
  rateLimit { remaining resetAt }
  repositoryOwner(login: $login) {
    repositories(first: 100, after: $after, orderBy: { field: PUSHED_AT, direction: DESC }) {
      pageInfo { hasNextPage endCursor }
      nodes { name isPrivate isArchived defaultBranchRef { name } }
    }
  }
}`;

export interface OwnerReposResult {
  rateLimit: RateLimit;
  repositoryOwner: {
    repositories: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      nodes: { name: string; isPrivate: boolean; isArchived: boolean; defaultBranchRef: { name: string } | null }[];
    };
  } | null;
}

const COMMENT_FIELDS = `id body createdAt authorAssociation author { login }`;

const ISSUE_FIELDS = `
  id number title body state url createdAt updatedAt closedAt authorAssociation
  author { login }
  labels(first: 20) { nodes { name color } }
  reactions { totalCount }
  comments(last: 50) { totalCount nodes { ${COMMENT_FIELDS} } }`;

const PR_FIELDS = `
  id number title body state url createdAt updatedAt closedAt mergedAt isDraft reviewDecision authorAssociation
  author { login }
  labels(first: 20) { nodes { name color } }
  reactions { totalCount }
  comments(last: 50) { totalCount nodes { ${COMMENT_FIELDS} } }
  reviews(last: 20) {
    nodes { id state body createdAt authorAssociation author { login } comments(first: 10) { nodes { ${COMMENT_FIELDS} } } }
  }
  reviewRequests(first: 10) { nodes { requestedReviewer { ... on User { login } ... on Team { slug } } } }`;

export const ISSUES_QUERY = `
query RepoIssues($owner: String!, $name: String!, $after: String, $since: DateTime, $states: [IssueState!]) {
  rateLimit { remaining resetAt }
  repository(owner: $owner, name: $name) {
    defaultBranchRef { name }
    issues(first: 25, after: $after, states: $states, filterBy: { since: $since }, orderBy: { field: UPDATED_AT, direction: ASC }) {
      pageInfo { hasNextPage endCursor }
      nodes { ${ISSUE_FIELDS} }
    }
  }
}`;

export const PRS_QUERY = `
query RepoPullRequests($owner: String!, $name: String!, $after: String, $states: [PullRequestState!]) {
  rateLimit { remaining resetAt }
  repository(owner: $owner, name: $name) {
    defaultBranchRef { name }
    pullRequests(first: 20, after: $after, states: $states, orderBy: { field: UPDATED_AT, direction: DESC }) {
      pageInfo { hasNextPage endCursor }
      nodes { ${PR_FIELDS} }
    }
  }
}`;

export interface PageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

export interface RawActor {
  login: string;
}

export interface RawComment {
  id: string;
  body: string;
  createdAt: string;
  authorAssociation: string;
  author: RawActor | null;
}

export interface RawIssue {
  id: string;
  number: number;
  title: string;
  body: string;
  state: "OPEN" | "CLOSED";
  url: string;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  authorAssociation: string;
  author: RawActor | null;
  labels: { nodes: { name: string; color: string }[] } | null;
  reactions: { totalCount: number };
  comments: { totalCount: number; nodes: RawComment[] };
}

export interface RawReview {
  id: string;
  state: string;
  body: string;
  createdAt: string;
  authorAssociation: string;
  author: RawActor | null;
  comments: { nodes: RawComment[] };
}

export interface RawPullRequest extends Omit<RawIssue, "state"> {
  state: "OPEN" | "CLOSED" | "MERGED";
  mergedAt: string | null;
  isDraft: boolean;
  reviewDecision: string | null;
  reviews: { nodes: RawReview[] };
  reviewRequests: { nodes: { requestedReviewer: { login?: string; slug?: string } | null }[] };
}

interface RepoPage<K extends string, N> {
  rateLimit: RateLimit;
  repository:
    | ({ defaultBranchRef: { name: string } | null } & Record<K, { pageInfo: PageInfo; nodes: N[] }>)
    | null;
}

export type IssuesPageResult = RepoPage<"issues", RawIssue>;
export type PrsPageResult = RepoPage<"pullRequests", RawPullRequest>;
