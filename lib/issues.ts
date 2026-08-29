/** Flattened issue model shared between the server fetch and the client browser. */
export interface IssueLabel {
  name: string;
  /** GitHub's hex color for the label, no leading `#`. */
  color: string;
}

export interface IssueItem {
  id: number;
  number: number;
  title: string;
  state: "open" | "closed";
  /** External github.com URL. */
  url: string;
  createdAt: string;
  updatedAt: string;
  comments: number;
  author: string;
  authorAvatar: string;
  /** Repository name within the org, e.g. `next.js`. */
  repo: string;
  labels: IssueLabel[];
}

export type StateFilter = "open" | "closed" | "all";
export type SortKey = "newest" | "oldest" | "updated" | "comments";

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "newest", label: "Newest" },
  { key: "oldest", label: "Oldest" },
  { key: "updated", label: "Recently updated" },
  { key: "comments", label: "Most commented" },
];

export interface IssueFilters {
  state: StateFilter;
  query: string;
  /** `"all"` or a repo name. */
  repo: string;
}

export function filterIssues(issues: IssueItem[], filters: IssueFilters): IssueItem[] {
  const query = filters.query.trim().toLowerCase();
  return issues.filter((issue) => {
    if (filters.state !== "all" && issue.state !== filters.state) return false;
    if (filters.repo !== "all" && issue.repo !== filters.repo) return false;
    if (!query) return true;
    return (
      issue.title.toLowerCase().includes(query) ||
      issue.repo.toLowerCase().includes(query) ||
      issue.labels.some((label) => label.name.toLowerCase().includes(query))
    );
  });
}

export function sortIssues(issues: IssueItem[], key: SortKey): IssueItem[] {
  const sorted = [...issues];
  switch (key) {
    case "newest":
      sorted.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
      break;
    case "oldest":
      sorted.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
      break;
    case "updated":
      sorted.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
      break;
    case "comments":
      sorted.sort((a, b) => b.comments - a.comments);
      break;
  }
  return sorted;
}

/** Issues shown per page in the browser (GitHub's own convention). */
export const ISSUES_PER_PAGE = 25;

/**
 * Windowed page-number sequence for the pagination bar.
 * Always shows the first/last page and the current page ±1, with
 * `"ellipsis"` markers for gaps. All pages are listed when there
 * are 7 or fewer.
 */
export function pageNumbers(current: number, totalPages: number): (number | "ellipsis")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const wanted = new Set<number>([1, totalPages, current - 1, current, current + 1]);
  const pages = [...wanted].filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b);
  const result: (number | "ellipsis")[] = [];
  let prev = 0;
  for (const page of pages) {
    if (page - prev > 1) result.push("ellipsis");
    result.push(page);
    prev = page;
  }
  return result;
}

/** Unique repo names, most-issues-first. */
export function deriveRepos(issues: IssueItem[]): string[] {
  const counts = new Map<string, number>();
  for (const issue of issues) {
    counts.set(issue.repo, (counts.get(issue.repo) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([repo]) => repo);
}

/**
 * Derives a readable chip tint from a label's real GitHub hex color
 * (rather than a hash-based pastel), so a label's chip actually
 * reflects how it's colored in the source repo.
 */
export function labelTint(hex: string): { background: string; color: string } {
  const clean = hex.replace(/^#/, "").padStart(6, "0");
  const r = parseInt(clean.slice(0, 2), 16) || 0;
  const g = parseInt(clean.slice(2, 4), 16) || 0;
  const b = parseInt(clean.slice(4, 6), 16) || 0;
  const mix = (channel: number, target: number, ratio: number) =>
    Math.round(channel * (1 - ratio) + target * ratio);
  const background = `rgb(${mix(r, 255, 0.86)}, ${mix(g, 255, 0.86)}, ${mix(b, 255, 0.86)})`;
  const color = `rgb(${mix(r, 0, 0.35)}, ${mix(g, 0, 0.35)}, ${mix(b, 0, 0.35)})`;
  return { background, color };
}
