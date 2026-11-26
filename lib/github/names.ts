/** GitHub login grammar: alphanumerics and hyphens, no leading/trailing hyphen, ≤ 39 chars. */
export function isValidLogin(login: string): boolean {
  return /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(login);
}

export function isValidRepoName(name: string): boolean {
  return /^[A-Za-z0-9._-]{1,100}$/.test(name) && name !== "." && name !== "..";
}

/** Accepts "owner/name", "github.com/owner/name", or a full URL (optional trailing "/" or ".git"). */
export function parseRepoFullName(input: string): { owner: string; name: string } | null {
  const cleaned = input
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/^github\.com\//, "")
    .replace(/\/+$/, "")
    .replace(/\.git$/, "");
  const parts = cleaned.split("/");
  if (parts.length !== 2) return null;
  const [owner, name] = parts as [string, string];
  return isValidLogin(owner) && isValidRepoName(name) ? { owner, name } : null;
}
