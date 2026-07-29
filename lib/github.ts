import type { IssueItem } from "./issues";

const API = "https://api.github.com";
const PAGE_SIZE = 100;
/** Pages fetched per org — the window size is PAGE_SIZE * WINDOW_PAGES. */
const WINDOW_PAGES = 5;

export type GitHubErrorKind = "not-found" | "rate-limited" | "api";

export class GitHubError extends Error {
  constructor(
    public kind: GitHubErrorKind,
    message: string,
    /** ms epoch, only for rate-limited. */
    public resetAt?: number,
  ) {
    super(message);
    this.name = "GitHubError";
  }
}

/** GitHub login grammar: alphanumerics and hyphens, no leading/trailing hyphen, ≤ 39 chars. */
export function isValidLogin(login: string): boolean {
  return /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(login);
}

async function gh<T>(path: string): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "gibit",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  const res = await fetch(`${API}${path}`, {
    headers,
    next: { revalidate: 300 },
  });

  if (res.status === 404) {
    throw new GitHubError("not-found", `Not found: ${path}`);
  }
  if ((res.status === 403 || res.status === 429) && res.headers.get("x-ratelimit-remaining") === "0") {
    const reset = Number(res.headers.get("x-ratelimit-reset")) * 1000;
    throw new GitHubError("rate-limited", "GitHub API rate limit reached", reset);
  }
  if (!res.ok) {
    throw new GitHubError("api", `GitHub responded ${res.status} for ${path}`);
  }
  return res.json() as Promise<T>;
}

export interface OrgProfile {
  login: string;
  name: string;
  description: string | null;
  avatarUrl: string;
  htmlUrl: string;
  publicRepos: number;
  followers: number;
}

interface RawOrg {
  login: string;
  name: string | null;
  description: string | null;
  avatar_url: string;
  html_url: string;
  public_repos: number;
  followers: number;
}

export async function fetchOrg(login: string): Promise<OrgProfile> {
  const raw = await gh<RawOrg>(`/orgs/${encodeURIComponent(login)}`);
  return {
    login: raw.login,
    name: raw.name ?? raw.login,
    description: raw.description,
    avatarUrl: raw.avatar_url,
    htmlUrl: raw.html_url,
    publicRepos: raw.public_repos,
    followers: raw.followers,
  };
}

interface RawSearchLabel {
  name?: string;
  color?: string;
}

interface RawSearchItem {
  id: number;
  number: number;
  title: string;
  state: string;
  html_url: string;
  created_at: string;
  updated_at: string;
  comments: number;
  user: { login: string; avatar_url: string } | null;
  labels: (RawSearchLabel | string)[];
  repository_url: string;
  pull_request?: unknown;
}

interface SearchResponse {
  total_count: number;
  items: RawSearchItem[];
}

function toIssueItem(raw: RawSearchItem): IssueItem {
  return {
    id: raw.id,
    number: raw.number,
    title: raw.title,
    state: raw.state === "closed" ? "closed" : "open",
    url: raw.html_url,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    comments: raw.comments,
    author: raw.user?.login ?? "ghost",
    authorAvatar: raw.user?.avatar_url ?? "",
    repo: raw.repository_url.split("/").pop() ?? "unknown",
    labels: raw.labels.flatMap((label) =>
      typeof label === "object" && label.name
        ? [{ name: label.name, color: label.color ?? "a4a097" }]
        : [],
    ),
  };
}

async function searchIssuesPage(login: string, page: number, perPage = PAGE_SIZE): Promise<SearchResponse> {
  const q = encodeURIComponent(`org:${login} is:issue`);
  return gh<SearchResponse>(
    `/search/issues?q=${q}&sort=created&order=desc&per_page=${perPage}&page=${page}`,
  );
}

export interface OrgIssuesResult {
  issues: IssueItem[];
  /** Org-wide issue count (all states) reported by the search API. */
  totalCount: number;
  /** Org-wide open-issue count; null when the count query failed. */
  openCount: number | null;
  /** True when the org has more issues than the fetched window. */
  truncated: boolean;
}

export async function searchOrgIssues(login: string): Promise<OrgIssuesResult> {
  // Page 1 establishes total_count; the remaining window pages run in parallel.
  const first = await searchIssuesPage(login, 1);
  const pageCount = Math.min(WINDOW_PAGES, Math.ceil(first.total_count / PAGE_SIZE));

  const rest = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, i) => searchIssuesPage(login, i + 2)),
  );

  // Best-effort org-wide open count — failure must not break the page.
  let openCount: number | null = null;
  try {
    const q = encodeURIComponent(`org:${login} is:issue is:open`);
    const open = await gh<SearchResponse>(`/search/issues?q=${q}&per_page=1`);
    openCount = open.total_count;
  } catch {
    openCount = null;
  }

  const issues = [first, ...rest]
    .flatMap((page) => page.items)
    .filter((item) => !item.pull_request)
    .map(toIssueItem);

  return {
    issues,
    totalCount: first.total_count,
    openCount,
    truncated: first.total_count > issues.length,
  };
}
