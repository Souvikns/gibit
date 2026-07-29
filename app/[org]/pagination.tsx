"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { pageNumbers } from "@/lib/issues";

interface PaginationProps {
  /** Current page, 1-based and already clamped. */
  page: number;
  totalPages: number;
  /** Filtered issue count being paged over. */
  total: number;
  perPage: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, total, perPage, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const rangeStart = (page - 1) * perPage + 1;
  const rangeEnd = Math.min(page * perPage, total);

  return (
    <nav
      aria-label="Issues pagination"
      className="mt-4 flex flex-wrap items-center justify-between gap-3"
    >
      <p className="text-body-sm text-stone tabular-nums">
        {rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()} of{" "}
        {total.toLocaleString()} issues
      </p>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          aria-label="Previous page"
          className={`flex items-center gap-1 rounded-sm px-3 py-2 text-body-sm font-medium transition-colors duration-150 ${
            page === 1
              ? "cursor-not-allowed text-muted"
              : "text-ink hover:bg-surface"
          }`}
        >
          <ChevronLeftIcon className="h-3 w-3" />
          Previous
        </button>

        {pageNumbers(page, totalPages).map((item, index) =>
          item === "ellipsis" ? (
            <span
              key={`ellipsis-${index}`}
              aria-hidden
              className="px-1 text-body-sm text-stone"
            >
              …
            </span>
          ) : (
            <button
              key={item}
              onClick={() => onPageChange(item)}
              aria-current={item === page ? "page" : undefined}
              aria-label={`Page ${item}`}
              className={`h-9 min-w-9 rounded-md px-2 text-body-sm font-medium tabular-nums transition-colors duration-150 ${
                item === page
                  ? "bg-ink-deep text-on-dark"
                  : "text-steel hover:bg-surface hover:text-ink"
              }`}
            >
              {item}
            </button>
          ),
        )}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          aria-label="Next page"
          className={`flex items-center gap-1 rounded-sm px-3 py-2 text-body-sm font-medium transition-colors duration-150 ${
            page === totalPages
              ? "cursor-not-allowed text-muted"
              : "text-ink hover:bg-surface"
          }`}
        >
          Next
          <ChevronRightIcon className="h-3 w-3" />
        </button>
      </div>
    </nav>
  );
}
