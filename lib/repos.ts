import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { repos } from "@/lib/db/schema";
import { GitHubError, graphql } from "@/lib/github/graphql";
import { isValidLogin, parseRepoFullName } from "@/lib/github/names";
import { OWNER_REPOS_QUERY, REPO_QUERY, type OwnerReposResult, type RepoQueryResult } from "@/lib/github/queries";

export type Repo = typeof repos.$inferSelect;

export interface OwnerRepo {
  name: string;
  private: boolean;
  archived: boolean;
  added: boolean;
}

const MAX_OWNER_PAGES = 3; // up to 300 repos

export async function listRepos(): Promise<Repo[]> {
  return db().select().from(repos).orderBy(asc(repos.owner), asc(repos.name));
}

export async function addRepo(input: string): Promise<Repo> {
  const parsed = parseRepoFullName(input);
  if (!parsed) throw new Error(`"${input}" is not a valid owner/name`);
  const { repository } = await graphql<RepoQueryResult>(REPO_QUERY, parsed);
  if (!repository) throw new GitHubError("not-found", `${parsed.owner}/${parsed.name} not found or not accessible`);

  const values = {
    owner: repository.owner.login,
    name: repository.name,
    private: repository.isPrivate,
    defaultBranch: repository.defaultBranchRef?.name ?? "main",
  };
  await db().insert(repos).values(values).onConflictDoNothing();
  const [row] = await db()
    .select()
    .from(repos)
    .where(and(eq(repos.owner, values.owner), eq(repos.name, values.name)));
  if (!row) throw new Error("Failed to save repo");
  return row;
}

export async function listOwnerRepos(owner: string): Promise<OwnerRepo[]> {
  if (!isValidLogin(owner)) throw new Error(`"${owner}" is not a valid GitHub login`);
  const existing = new Set(
    (await db().select({ name: repos.name }).from(repos).where(eq(repos.owner, owner))).map((r) => r.name),
  );
  const result: OwnerRepo[] = [];
  let after: string | null = null;
  for (let page = 0; page < MAX_OWNER_PAGES; page++) {
    const data: OwnerReposResult = await graphql<OwnerReposResult>(OWNER_REPOS_QUERY, { login: owner, after });
    if (!data.repositoryOwner) throw new GitHubError("not-found", `${owner} not found`);
    const { nodes, pageInfo } = data.repositoryOwner.repositories;
    for (const node of nodes) {
      result.push({ name: node.name, private: node.isPrivate, archived: node.isArchived, added: existing.has(node.name) });
    }
    if (!pageInfo.hasNextPage) break;
    after = pageInfo.endCursor;
  }
  return result;
}

/** Bulk add stores the default branch as "main"; the first sync corrects it. */
export async function addRepos(owner: string, names: string[]): Promise<number> {
  if (names.length === 0) return 0;
  const wanted = new Set(names);
  const candidates = (await listOwnerRepos(owner)).filter((r) => wanted.has(r.name) && !r.added);
  if (candidates.length === 0) return 0;
  await db()
    .insert(repos)
    .values(candidates.map((r) => ({ owner, name: r.name, private: r.private })))
    .onConflictDoNothing();
  return candidates.length;
}

export async function removeRepo(id: number): Promise<void> {
  await db().delete(repos).where(eq(repos.id, id));
}

export async function setRepoEnabled(id: number, enabled: boolean): Promise<void> {
  await db().update(repos).set({ enabled }).where(eq(repos.id, id));
}
