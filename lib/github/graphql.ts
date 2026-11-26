const ENDPOINT = "https://api.github.com/graphql";

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

export interface RateLimit {
  remaining: number;
  resetAt: string;
}

interface GraphQLResponse<T> {
  data?: T | null;
  errors?: { type?: string; message: string }[];
}

export async function graphql<T>(
  query: string,
  variables: Record<string, unknown> = {},
  fetchImpl: typeof fetch = fetch,
): Promise<T> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new GitHubError("api", "GITHUB_TOKEN is not set");

  const res = await fetchImpl(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "gibit",
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  if (res.status === 401) throw new GitHubError("api", "GitHub rejected GITHUB_TOKEN (401). Check the token.");
  if ((res.status === 403 || res.status === 429) && res.headers.get("x-ratelimit-remaining") === "0") {
    const resetSeconds = Number(res.headers.get("x-ratelimit-reset"));
    throw new GitHubError(
      "rate-limited",
      "GitHub API rate limit reached",
      Number.isFinite(resetSeconds) && resetSeconds > 0 ? resetSeconds * 1000 : undefined,
    );
  }
  if (!res.ok) throw new GitHubError("api", `GitHub GraphQL responded ${res.status}`);

  const body = (await res.json()) as GraphQLResponse<T>;
  if (body.errors?.length) {
    if (body.errors.some((e) => e.type === "NOT_FOUND")) {
      throw new GitHubError("not-found", body.errors.map((e) => e.message).join("; "));
    }
    if (body.errors.some((e) => e.type === "RATE_LIMITED")) {
      throw new GitHubError("rate-limited", "GitHub API rate limit reached");
    }
    throw new GitHubError("api", body.errors.map((e) => e.message).join("; "));
  }
  if (!body.data) throw new GitHubError("api", "GitHub GraphQL returned no data");
  return body.data;
}
