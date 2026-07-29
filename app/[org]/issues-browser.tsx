"use client";

import { useMemo, useRef, useState } from "react";
import {
  deriveRepos,
  filterIssues,
  ISSUES_PER_PAGE,
  sortIssues,
  type IssueItem,
  type SortKey,
  type StateFilter,
} from "@/lib/issues";
import { IssueRow } from "./issue-row";
import { Pagination } from "./pagination";
import { Toolbar } from "./toolbar";

interface IssuesBrowserProps {
  issues: IssueItem[];
  totalCount: number;
  truncated: boolean;
}

const EMPTY_FILTERS = { state: "open" as StateFilter, query: "", repo: "all" };

export function IssuesBrowser({ issues, totalCount, truncated }: IssuesBrowserProps) {
  const [state, setState] = useState<StateFilter>(EMPTY_FILTERS.state);
  const [query, setQuery] = useState(EMPTY_FILTERS.query);
  const [repo, setRepo] = useState(EMPTY_FILTERS.repo);
  const [sort, setSort] = useState<SortKey>("newest");
  const [page, setPage] = useState(1);
  const listRef = useRef<HTMLUListElement>(null);

  const counts = useMemo<Record<StateFilter, number>>(
    () => ({
      open: issues.filter((issue) => issue.state === "open").length,
      closed: issues.filter((issue) => issue.state === "closed").length,
      all: issues.length,
    }),
    [issues],
  );

  const repos = useMemo(() => deriveRepos(issues), [issues]);

  const visible = useMemo(
    () => sortIssues(filterIssues(issues, { state, query, repo }), sort),
    [issues, state, query, repo, sort],
  );

  const totalPages = Math.ceil(visible.length / ISSUES_PER_PAGE);
  const currentPage = Math.min(page, Math.max(totalPages, 1));
  const pageItems = useMemo(
    () => visible.slice((currentPage - 1) * ISSUES_PER_PAGE, currentPage * ISSUES_PER_PAGE),
    [visible, currentPage],
  );

  function clearFilters() {
    setState(EMPTY_FILTERS.state);
    setQuery(EMPTY_FILTERS.query);
    setRepo(EMPTY_FILTERS.repo);
    setPage(1);
  }

  function handlePageChange(next: number) {
    setPage(next);
    listRef.current?.scrollIntoView({ block: "start" });
  }

  return (
    <div>
      <Toolbar
        state={state}
        onStateChange={(next) => {
          setState(next);
          setPage(1);
        }}
        counts={counts}
        query={query}
        onQueryChange={(next) => {
          setQuery(next);
          setPage(1);
        }}
        repo={repo}
        repos={repos}
        onRepoChange={(next) => {
          setRepo(next);
          setPage(1);
        }}
        sort={sort}
        onSortChange={(next) => {
          setSort(next);
          setPage(1);
        }}
      />

      {truncated && (
        <p className="mt-6 rounded-md bg-surface px-4 py-3 text-body-sm font-medium text-ink">
          Showing the newest{" "}
          <span className="tabular-nums">{issues.length.toLocaleString()}</span> of{" "}
          <span className="tabular-nums">{totalCount.toLocaleString()}</span> issues in
          this org — use search and filters to narrow down.
        </p>
      )}

      {issues.length === 0 ? (
        <div className="py-24 text-center">
          <h2 className="text-heading-4 text-ink">No public issues</h2>
          <p className="mt-2 text-body-sm text-slate">
            This organization doesn&apos;t have any issues across its public
            repositories.
          </p>
        </div>
      ) : visible.length === 0 ? (
        <div className="py-24 text-center">
          <h2 className="text-heading-4 text-ink">No issues match these filters</h2>
          <p className="mt-2 text-body-sm text-slate">
            Try a different keyword, repository, or state.
          </p>
          <button
            onClick={clearFilters}
            className="mt-5 rounded-sm px-3 py-2 text-body-sm font-medium text-ink transition-colors duration-150 hover:bg-surface"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <>
          <ul
            ref={listRef}
            className="mt-6 scroll-mt-36 divide-y divide-hairline-soft overflow-hidden rounded-lg border border-hairline bg-canvas"
          >
            {pageItems.map((issue) => (
              <IssueRow key={issue.id} issue={issue} />
            ))}
          </ul>
          <Pagination
            page={currentPage}
            totalPages={totalPages}
            total={visible.length}
            perPage={ISSUES_PER_PAGE}
            onPageChange={handlePageChange}
          />
        </>
      )}
    </div>
  );
}
