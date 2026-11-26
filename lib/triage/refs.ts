import { isValidLogin, isValidRepoName } from "@/lib/github/names";

/** Parses "owner/repo#123". */
export function parseRef(ref: string): { owner: string; name: string; number: number } | null {
  const match = /^([^/\s#]+)\/([^/\s#]+)#(\d+)$/.exec(ref.trim());
  if (!match) return null;
  const [, owner = "", name = "", num = ""] = match;
  const number = Number(num);
  if (!isValidLogin(owner) || !isValidRepoName(name) || !Number.isSafeInteger(number) || number < 1) return null;
  return { owner, name, number };
}

export function formatRef(owner: string, name: string, number: number): string {
  return `${owner}/${name}#${number}`;
}
