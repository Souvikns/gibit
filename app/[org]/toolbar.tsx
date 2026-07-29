"use client";

import { ChevronDownIcon, SearchIcon } from "@/components/icons";
import { SORT_OPTIONS, type SortKey, type StateFilter } from "@/lib/issues";

const STATE_TABS: { key: StateFilter; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "closed", label: "Closed" },
  { key: "all", label: "All" },
];

interface ToolbarProps {
  state: StateFilter;
  onStateChange: (state: StateFilter) => void;
  counts: Record<StateFilter, number>;
  query: string;
  onQueryChange: (query: string) => void;
  repo: string;
  repos: string[];
  onRepoChange: (repo: string) => void;
  sort: SortKey;
  onSortChange: (sort: SortKey) => void;
}

export function Toolbar({
  state,
  onStateChange,
  counts,
  query,
  onQueryChange,
  repo,
  repos,
  onRepoChange,
  sort,
  onSortChange,
}: ToolbarProps) {
  return (
    <div className="sticky top-16 z-30 -mx-6 border-b border-hairline-soft bg-canvas/95 px-6 py-3 backdrop-blur">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2" role="tablist" aria-label="Issue state">
          {STATE_TABS.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={state === tab.key}
              onClick={() => onStateChange(tab.key)}
              className={
                state === tab.key
                  ? "rounded-full border border-ink-deep bg-ink-deep px-4 py-1.5 text-body-sm font-medium text-on-dark"
                  : "rounded-full border border-hairline px-4 py-1.5 text-body-sm font-medium text-steel transition-colors duration-150 hover:text-ink"
              }
            >
              {tab.label}{" "}
              <span className="tabular-nums opacity-70">{counts[tab.key]}</span>
            </button>
          ))}
        </div>

        <div className="relative min-w-44 flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-stone" />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            type="search"
            aria-label="Filter issues by keyword"
            placeholder="Filter by title, repo, or label…"
            className="h-9 w-full rounded-md border border-hairline bg-surface pr-3 pl-9 text-body-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none"
          />
        </div>

        <label className="relative">
          <span className="sr-only">Filter by repository</span>
          <select
            value={repo}
            onChange={(event) => onRepoChange(event.target.value)}
            className="h-9 max-w-44 appearance-none rounded-md border border-hairline-strong bg-canvas pr-8 pl-3 text-body-sm text-ink focus:border-primary focus:outline-none"
          >
            <option value="all">All repositories ({repos.length})</option>
            {repos.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-stone" />
        </label>

        <label className="relative">
          <span className="sr-only">Sort issues</span>
          <select
            value={sort}
            onChange={(event) => onSortChange(event.target.value as SortKey)}
            className="h-9 appearance-none rounded-md border border-hairline-strong bg-canvas pr-8 pl-3 text-body-sm text-ink focus:border-primary focus:outline-none"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-stone" />
        </label>
      </div>
    </div>
  );
}
