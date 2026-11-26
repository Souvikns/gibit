import { GitHubError, graphql, type RateLimit } from "@/lib/github/graphql";
import { mapIssue, mapPullRequest, type MappedItem } from "@/lib/github/map";
import { ISSUES_QUERY, PRS_QUERY, type IssuesPageResult, type PrsPageResult } from "@/lib/github/queries";
import type { RepoSyncState } from "@/lib/model";
import { phaseKind } from "./plan";

export interface FetchedPage {
  mapped: MappedItem[];
  hasNextPage: boolean;
  endCursor: string | null;
  reachedSince: boolean;
  maxUpdatedAt: string | null;
  defaultBranch: string | null;
  rateLimit: RateLimit;
}

function newest(nodes: { updatedAt: string }[]): string | null {
  return nodes.reduce<string | null>((max, n) => (!max || n.updatedAt > max ? n.updatedAt : max), null);
}

export async function fetchPage(
  repo: { id: number; owner: string; name: string },
  state: RepoSyncState,
  ownerLogin: string,
): Promise<FetchedPage> {
  const base = { owner: repo.owner, name: repo.name, after: state.after };

  if (phaseKind(state.phase) === "issues") {
    const variables =
      state.phase === "issues-open"
        ? { ...base, states: ["OPEN"], since: null }
        : { ...base, states: null, since: state.since };
    const data = await graphql<IssuesPageResult>(ISSUES_QUERY, variables);
    if (!data.repository) throw new GitHubError("not-found", `${repo.owner}/${repo.name} not found`);
    const { nodes, pageInfo } = data.repository.issues;
    return {
      mapped: nodes.map((n) => mapIssue(n, repo.id, ownerLogin)),
      hasNextPage: pageInfo.hasNextPage,
      endCursor: pageInfo.endCursor,
      reachedSince: false,
      maxUpdatedAt: newest(nodes),
      defaultBranch: data.repository.defaultBranchRef?.name ?? null,
      rateLimit: data.rateLimit,
    };
  }

  const variables = { ...base, states: state.phase === "prs-open" ? ["OPEN"] : null };
  const data = await graphql<PrsPageResult>(PRS_QUERY, variables);
  if (!data.repository) throw new GitHubError("not-found", `${repo.owner}/${repo.name} not found`);
  const { nodes, pageInfo } = data.repository.pullRequests;
  // prs-recent is ordered newest-first: keep only nodes at/after `since`, and stop once we pass it.
  const since = state.since;
  const inWindow = state.phase === "prs-recent" && since ? nodes.filter((n) => n.updatedAt >= since) : nodes;
  return {
    mapped: inWindow.map((n) => mapPullRequest(n, repo.id, ownerLogin)),
    hasNextPage: pageInfo.hasNextPage,
    endCursor: pageInfo.endCursor,
    reachedSince: inWindow.length < nodes.length,
    maxUpdatedAt: newest(inWindow),
    defaultBranch: data.repository.defaultBranchRef?.name ?? null,
    rateLimit: data.rateLimit,
  };
}
