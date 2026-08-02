import type { SortKey, StateFilter } from "./issues";

export interface FilterState {
  state: StateFilter;
  query: string;
  repo: string;
  sort: SortKey;
  page: number;
}

export const DEFAULT_FILTERS: FilterState = {
  state: "open",
  query: "",
  repo: "all",
  sort: "newest",
  page: 1,
};

const STATES: StateFilter[] = ["open", "closed", "all"];
const SORTS: SortKey[] = ["newest", "oldest", "updated", "comments"];

export function parseFilters(params: URLSearchParams): FilterState {
  const state = params.get("state");
  const sort = params.get("sort");
  const page = Number.parseInt(params.get("page") ?? "1", 10);
  return {
    state: state && STATES.includes(state as StateFilter) ? (state as StateFilter) : DEFAULT_FILTERS.state,
    query: params.get("q") ?? DEFAULT_FILTERS.query,
    repo: params.get("repo") || DEFAULT_FILTERS.repo,
    sort: sort && SORTS.includes(sort as SortKey) ? (sort as SortKey) : DEFAULT_FILTERS.sort,
    page: Number.isFinite(page) && page > 0 ? page : DEFAULT_FILTERS.page,
  };
}

export function serializeFilters(filters: FilterState): string {
  const params = new URLSearchParams();
  if (filters.state !== DEFAULT_FILTERS.state) params.set("state", filters.state);
  if (filters.query.trim()) params.set("q", filters.query.trim());
  if (filters.repo !== DEFAULT_FILTERS.repo) params.set("repo", filters.repo);
  if (filters.sort !== DEFAULT_FILTERS.sort) params.set("sort", filters.sort);
  if (filters.page !== DEFAULT_FILTERS.page) params.set("page", String(filters.page));
  const query = params.toString();
  return query ? `?${query}` : "";
}
