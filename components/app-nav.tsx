import Link from "next/link";
import { logout } from "@/app/(app)/actions";

const LINKS = [{ href: "/settings", label: "Settings" }] as const;

export function AppNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-canvas/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-heading-5 tracking-tight text-ink-deep">
            gibit
          </Link>
          <nav className="flex items-center gap-4">
            {LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="text-body-sm text-slate hover:text-ink">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <form action={logout}>
          <button type="submit" className="text-body-sm text-slate hover:text-ink">
            Log out
          </button>
        </form>
      </div>
    </header>
  );
}
