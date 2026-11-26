"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/server";
import { addRepo, addRepos, listOwnerRepos, removeRepo, setRepoEnabled, type OwnerRepo } from "@/lib/repos";

export interface ActionResult {
  ok: string | null;
  error: string | null;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

export async function addRepoAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireSession();
  try {
    const repo = await addRepo(String(formData.get("repo") ?? ""));
    revalidatePath("/settings");
    return { ok: `Added ${repo.owner}/${repo.name}`, error: null };
  } catch (error) {
    return { ok: null, error: message(error) };
  }
}

export async function listOwnerReposAction(owner: string): Promise<{ repos: OwnerRepo[]; error: string | null }> {
  await requireSession();
  try {
    return { repos: await listOwnerRepos(owner.trim()), error: null };
  } catch (error) {
    return { repos: [], error: message(error) };
  }
}

export async function addReposAction(owner: string, names: string[]): Promise<ActionResult> {
  await requireSession();
  try {
    const count = await addRepos(owner, names);
    revalidatePath("/settings");
    return { ok: `Added ${count} repo${count === 1 ? "" : "s"}`, error: null };
  } catch (error) {
    return { ok: null, error: message(error) };
  }
}

export async function removeRepoAction(id: number): Promise<void> {
  await requireSession();
  await removeRepo(id);
  revalidatePath("/settings");
}

export async function toggleRepoAction(id: number, enabled: boolean): Promise<void> {
  await requireSession();
  await setRepoEnabled(id, enabled);
  revalidatePath("/settings");
}
