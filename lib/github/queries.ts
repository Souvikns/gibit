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
