"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_FILTERS, parseFilters, serializeFilters, type FilterState } from "@/lib/filters";
import {
  deriveRepos,
  filterIssues,
  ISSUES_PER_PAGE,
  sortIssues,
  type IssueItem,
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

export function IssuesBrowser({ issues, totalCount, truncated }: IssuesBrowserProps) {
  const pathname = usePathname();
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [queryInput, setQueryInput] = useState(filters.query);
  const [initialized, setInitialized] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const next = parseFilters(new URLSearchParams(window.location.search));
    setFilters(next);
    setQueryInput(next.query);
    setInitialized(true);
  }, []);

  useEffect(() => {
    function handlePopState() {
      const next = parseFilters(new URLSearchParams(window.location.search));
      setFilters(next);
      setQueryInput(next.query);
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setFilters((current) =>
        current.query === queryInput ? current : { ...current, query: queryInput, page: 1 },
      );
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [queryInput]);

  useEffect(() => {
    if (!initialized) return;
    const query = serializeFilters(filters);
    if (query !== window.location.search) {
      window.history.replaceState(null, "", `${pathname}${query}`);
    }
  }, [filters, initialized, pathname]);

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
    () => sortIssues(filterIssues(issues, filters), filters.sort),
    [issues, filters],
  );
  const totalPages = Math.ceil(visible.length / ISSUES_PER_PAGE);
  const currentPage = Math.min(filters.page, Math.max(totalPages, 1));
  const pageItems = useMemo(
    () => visible.slice((currentPage - 1) * ISSUES_PER_PAGE, currentPage * ISSUES_PER_PAGE),
    [visible, currentPage],
  );

  useEffect(() => {
    if (initialized && filters.page !== currentPage) {
      setFilters((current) => ({ ...current, page: currentPage }));
    }
  }, [currentPage, filters.page, initialized]);

  function clearFilters() {
    setQueryInput(DEFAULT_FILTERS.query);
    setFilters(DEFAULT_FILTERS);
  }

  function handlePageChange(next: number) {
    setFilters((current) => ({ ...current, page: next }));
    listRef.current?.scrollIntoView({ block: "start" });
  }

  return (
    <div>
      <Toolbar
        state={filters.state}
        onStateChange={(next) => setFilters((current) => ({ ...current, state: next, page: 1 }))}
        counts={counts}
        query={queryInput}
        onQueryChange={setQueryInput}
        repo={filters.repo}
        repos={repos}
        onRepoChange={(next) => setFilters((current) => ({ ...current, repo: next, page: 1 }))}
        sort={filters.sort}
        onSortChange={(next) => setFilters((current) => ({ ...current, sort: next, page: 1 }))}
      />

      <p className="sr-only" aria-live="polite">
        {visible.length.toLocaleString()} issues match the current filters.
      </p>

      {truncated && (
        <p className="mt-6 rounded-md bg-surface px-4 py-3 text-body-sm font-medium text-ink">
          Showing the newest <span className="tabular-nums">{issues.length.toLocaleString()}</span> of{" "}
          <span className="tabular-nums">{totalCount.toLocaleString()}</span> issues in this org — use
          search and filters to narrow down.
        </p>
      )}

      {issues.length === 0 ? (
        <div className="py-24 text-center">
          <h2 className="text-heading-4 text-ink">No public issues</h2>
          <p className="mt-2 text-body-sm text-slate">
            This organization doesn&apos;t have any issues across its public repositories.
          </p>
        </div>
      ) : visible.length === 0 ? (
        <div className="py-24 text-center">
          <h2 className="text-heading-4 text-ink">No issues match these filters</h2>
          <p className="mt-2 text-body-sm text-slate">Try a different keyword, repository, or state.</p>
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
            id="issue-results"
            role="tabpanel"
            aria-label="Issue results"
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
