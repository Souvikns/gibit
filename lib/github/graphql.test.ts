import { expect, test } from "bun:test";
import { GitHubError, graphql } from "./graphql";

process.env.GITHUB_TOKEN = "test-token";

function fakeFetch(status: number, body: unknown, headers: Record<string, string> = {}): typeof fetch {
  return (async () => new Response(JSON.stringify(body), { status, headers })) as unknown as typeof fetch;
}

test("returns data on success", async () => {
  const data = await graphql<{ viewer: { login: string } }>(
    "query { viewer { login } }",
    {},
    fakeFetch(200, { data: { viewer: { login: "me" } } }),
  );
  expect(data.viewer.login).toBe("me");
});

test("maps NOT_FOUND errors", async () => {
  const run = graphql("q", {}, fakeFetch(200, { data: { repository: null }, errors: [{ type: "NOT_FOUND", message: "Could not resolve" }] }));
  await expect(run).rejects.toMatchObject({ kind: "not-found" });
});

test("maps RATE_LIMITED errors", async () => {
  const run = graphql("q", {}, fakeFetch(200, { errors: [{ type: "RATE_LIMITED", message: "limit" }] }));
  await expect(run).rejects.toMatchObject({ kind: "rate-limited" });
});

test("maps 403 with exhausted rate limit and reset", async () => {
  const run = graphql("q", {}, fakeFetch(403, {}, { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1800000000" }));
  await expect(run).rejects.toMatchObject({ kind: "rate-limited", resetAt: 1_800_000_000_000 });
});

test("maps 401 to an api error mentioning the token", async () => {
  const run = graphql("q", {}, fakeFetch(401, {}));
  await expect(run).rejects.toThrow(/GITHUB_TOKEN/);
});

test("maps other GraphQL errors to api", async () => {
  const run = graphql("q", {}, fakeFetch(200, { errors: [{ message: "boom" }] }));
  await expect(run).rejects.toBeInstanceOf(GitHubError);
  await expect(run).rejects.toMatchObject({ kind: "api" });
});
