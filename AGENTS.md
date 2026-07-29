# AGENTS.md

gibit: Next.js 16 + Tailwind CSS v4 app that collates GitHub issues across an
org's repos. Two routes: `/` (landing) and `/{org}` (issues browser).

## Commands

- Package manager is **Bun** (`bun.lock`). Use `bun install`, `bun run dev`,
  `bun run build`.
- **No test runner, linter, or formatter is configured** — the only scripts are
  `dev` / `build` / `start`. Verify changes with `bunx tsc --noEmit` (strict;
  passes clean) and `bun run build`. Do not add lint/test config without being
  asked. (`app/[org]/page.tsx` has a leftover eslint-disable comment; ESLint is
  not installed.)

## Design system (the big one)

- `design.md` is the visual source of truth (Notion design system). Its tokens
  are mapped 1:1 into Tailwind v4 `@theme` in `app/globals.css`; keep token
  names traceable to design.md when adding new ones.
- **Use the named tokens, never arbitrary values or default-palette colors**:
  `text-body-sm` / `text-heading-4` (not `text-sm`), `text-ink` / `text-stone` /
  `text-slate` (not `text-gray-*`), `bg-canvas` / `bg-surface`,
  `border-hairline`, `rounded-sm`…`rounded-3xl` (design.md radii),
  `bg-card-tint-*` pastels, `text-link-blue`.
- Tailwind v4 CSS-first config: everything lives in `globals.css` via
  `@import "tailwindcss"` + `@theme`. There is no `tailwind.config.js` — don't
  create one.
- Tailwind scans source for class strings: dynamic classes must be written out
  in full (see `labelTint` in `lib/issues.ts`). Never interpolate class names.

## Architecture

- No API routes, no database, no auth. `app/[org]/page.tsx` (server component)
  fetches from the GitHub API via `lib/github.ts` and passes a plain
  `IssueItem[]` to `IssuesBrowser` (client component), which does all
  filter/sort in memory and paginates the filtered list client-side
  (`ISSUES_PER_PAGE` in `lib/issues.ts`; page turns never fetch). Pure helpers
  live in `lib/issues.ts` / `lib/time.ts` and are shared by server and
  client — keep them dependency-free.
- **500-issue window is deliberate** (`PAGE_SIZE * WINDOW_PAGES` in
  `lib/github.ts`): GitHub's search API caps at 1,000 results and
  unauthenticated search is limited to 10 req/min. Don't add pagination beyond
  the window; the truncation notice is the intended UX.
- Optional server-only `GITHUB_TOKEN` env var raises rate limits (`.env*` is
  gitignored). Without it, expect rate-limit errors in local dev.
- Errors are typed: `GitHubError` with `kind: "not-found" | "rate-limited" |
  "api"` → `not-found.tsx` / `ErrorCard`. Validate logins with `isValidLogin`
  before any network call.
- Icons are inline SVG components in `components/icons.tsx` — intentionally no
  icon library.
- Path alias `@/*` → repo root. tsconfig has extra strict flags
  (`noUncheckedIndexedAccess` etc.): indexed access yields `T | undefined`.

## Scope guardrails

The approved spec (`docs/superpowers/specs/2026-07-29-gibit-design.md`)
explicitly lists out-of-scope (YAGNI): pull requests, pagination beyond the
window, label-based filtering, GitHub Enterprise, auth, dark mode, tests.
Don't add these unprompted.
