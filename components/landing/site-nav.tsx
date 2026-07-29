import Link from "next/link";
import type { ReactNode } from "react";

export function SiteNav({ right }: { right?: ReactNode }) {
  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-canvas/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-6">
        <Link href="/" className="shrink-0 text-heading-5 tracking-tight text-ink-deep">
          gibit
        </Link>
        <div className="flex items-center gap-3">{right}</div>
      </div>
    </header>
  );
}
