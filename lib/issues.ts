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
 * Deterministic design.md pastel tint for a label name.
 * Returns full static class strings so Tailwind can see them.
 */
export function labelTint(name: string): { chip: string; dot: string } {
  const tints = [
    { chip: "bg-card-tint-lavender text-brand-purple-800", dot: "#7b3ff2" },
    { chip: "bg-card-tint-peach text-brand-orange-deep", dot: "#dd5b00" },
    { chip: "bg-card-tint-mint text-brand-green", dot: "#1aae39" },
    { chip: "bg-card-tint-sky text-link-blue-pressed", dot: "#0075de" },
    { chip: "bg-card-tint-rose text-brand-pink-deep", dot: "#ff64c8" },
    { chip: "bg-card-tint-yellow text-brand-brown", dot: "#b79b00" },
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return tints[hash % tints.length]!;
}
