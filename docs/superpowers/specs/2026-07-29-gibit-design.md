# Gibit — Landing Page + Org Issues Browser

Date: 2026-07-29
Status: Approved

## Summary

Gibit searches and collates GitHub issues from a single organization. Two routes:
a landing page (`/`) with product story + org search, and `/{org}` which fetches
issues across all repos in a GitHub org and renders them as a sortable,
filterable list. Visual design follows [`design.md`](../../../design.md)
(Notion design system) strictly; tokens are already mapped into Tailwind v4
`@theme` in `app/globals.css`.

## Data strategy (decided)

**Window + notice.** The GitHub issue search API caps at 1,000 results per
query and rate-limits unauthenticated search to 10 req/min. The `/{org}` page
fetches the newest **500 issues** server-side (5 pages × `per_page=100`,
parallel), then performs **instant client-side sort/filter** within that
window. When the org has more issues than the window, a `promo-banner`-style
strip discloses it: "Showing newest 500 of N issues — narrow down with search
and filters."

## Architecture

- No API routes, no database, no auth. Data fetching happens in the `/{org}`
  server component; results pass into a client component (`IssuesBrowser`)
  holding filter/sort state in memory.
- Optional `GITHUB_TOKEN` env var (server-only) raises rate limits; never
  shipped to the client.
- Fetch caching via `next: { revalidate: 300 }`.

### GitHub API (`lib/github.ts`)

- `fetchOrg(login)` → `GET /orgs/{login}` → `OrgProfile`
- `searchOrgIssues(login)` → Search API `q=org:{login} is:issue`,
  `sort=created&order=desc`, 5 pages in parallel + one `per_page=1` query for
  the org-wide open-issue count (best-effort; failure degrades to `null`)
- Headers: `Accept: application/vnd.github+json`, `User-Agent: gibit`,
  `X-GitHub-Api-Version: 2022-11-28`, optional `Authorization: Bearer …`
- Items containing `pull_request` are filtered out defensively (issues only)
- Typed errors: `GitHubError` with `kind: "not-found" | "rate-limited" | "api"`;
  rate-limited carries `resetAt` (ms epoch) from `x-ratelimit-reset`
- Org login validated against GitHub's login grammar before fetching;
  invalid → 404 page

### Pure helpers (`lib/issues.ts`, `lib/time.ts`)

- `IssueItem` — flattened issue model: id, number, title, state, url,
  createdAt, updatedAt, comments, author, authorAvatar, repo, labels
  (`{name, color}[]`)
- `filterIssues(issues, {state, query, repo})` — state (`open`/`closed`/`all`),
  repo (`"all"` or name), query matches title/repo/label names (case-insensitive)
- `sortIssues(issues, key)` — `newest` (created desc, default), `oldest`,
  `updated` (updated desc), `comments` (comments desc)
- `deriveRepos(issues)` — unique repo names, most-issues-first
- `labelTint(name)` — deterministic hash → one of the design.md pastel
  `badge-tag-*` tint pairs (lavender/peach/mint/sky/yellow/rose)
- `relativeTime(iso)` — "3d ago" style strings

## Routes & pages

### `/` — Landing (server component)

- **Top nav** (sticky white, hairline border): `gibit` lowercase wordmark
  (heading-5, ink-deep) → `/`; right: GitHub source link (button-ghost)
- **Hero band dark** (`hero-band-dark`, brand-navy): scattered sticky-note dots
  in brand colors + mesh-wire SVG decoration around centered content:
  - Eyebrow (micro-uppercase, on-dark-muted): `OPEN SOURCE ISSUE EXPLORER`
  - H1 (hero-display, on-dark): **"Find the issue worth fixing."**
  - Subtitle (subtitle, on-dark-muted): "Gibit collates issues from every repo
    in a GitHub organization into one fast, filterable list."
  - Org search (client component `OrgSearch`, hero variant): white 44px
    text-input ("Enter a GitHub org — e.g. vercel") + purple `button-primary`
    "Search issues". Normalizes input (strips `https://github.com/`, `@`,
    paths/trailing slashes) → routes to `/{org}`. Below: "Try: vercel ·
    facebook · golang" quiet on-dark links.
  - **Mock issue-list card** (`workspace-mockup-card` analog, `shadow-mockup`)
    breaking out of the navy band via negative margin — 4 crafted fake rows
    with state icons and pastel label chips
- **Feature trio** (3-col pastel grid): `card-tint-sky` "One search, every
  repo" · `card-tint-mint` "Filter the noise" · `card-tint-lavender` "Sort by
  what matters" — each with a small CSS-built UI sketch, heading-4 + body-sm
- **Bold yellow banner** (`card-feature-yellow-bold`): "Hunting for your first
  contribution?" + `button-dark` CTA → `/vercel`
- **How it works** (`stat-row` surface band): 3 steps — Type an org → Browse
  the collated list → Jump into GitHub
- **Footer** (`footer-region`): wordmark + tagline, link columns (Examples,
  Resources)

### `/{org}` — Issues browser

- Same top nav + compact `OrgSearch` (nav variant, search-pill style, Enter to
  submit) for switching orgs
- **Org header**: avatar (rounded-lg), display name (heading-2) + `@login`
  (stone), description (body-md, slate), meta (N public repos · M followers ·
  M open issues when available), "View on GitHub" button-link
- **Cap notice** (promo-banner strip) when `totalCount > issues.length`
- **Toolbar** (sticky under nav):
  - State pill-tabs: Open (default, `pill-tab-active`) / Closed / All, with
    counts from the loaded window
  - search-pill text input (title/repo/labels)
  - Repo select (derived from loaded issues)
  - Sort select: Newest / Oldest / Recently updated / Most commented
- **Issue list**: bordered rounded-lg container; rows = state icon (green open
  circle / purple closed check, GitHub-style) · title (body-md-medium,
  external link to GitHub) · label chips (design tint + 6px dot in the label's
  real GitHub color; max 3 + "+N" overflow) · meta caption (`#1234 · repo ·
  opened 3d ago by user`) · comment count right-aligned when > 0
- **States**: `loading.tsx` skeleton rows · `not-found.tsx` ("Org not found" +
  search-again) · `error.tsx` (rate-limit card with reset time + `GITHUB_TOKEN`
  hint + retry via `router.refresh()`; generic API error otherwise) ·
  empty-filter state with "Clear filters" ghost button
- `generateMetadata`: `{org} issues — gibit`

## File map

```
app/page.tsx                      landing (rewrite)
app/[org]/page.tsx                org page (server fetch)
app/[org]/loading.tsx             skeleton
app/[org]/not-found.tsx           org not found
app/[org]/error.tsx               rate-limit / API error (client)
app/[org]/issues-browser.tsx      client: filter/sort state + list
app/[org]/issue-row.tsx           row + label chips + state icon
app/[org]/toolbar.tsx             tabs, search, selects (client)
components/landing/site-nav.tsx   nav (right slot for compact search)
components/landing/org-search.tsx client search, hero + nav variants
components/landing/hero.tsx       navy band + decorations
components/landing/mock-issue-card.tsx
components/landing/feature-grid.tsx
components/landing/yellow-banner.tsx
components/landing/steps.tsx
components/landing/site-footer.tsx
components/icons.tsx              inline SVGs (github, issue, check, comment, search)
lib/github.ts  lib/issues.ts  lib/time.ts
```

Icons are inline SVG components — no new dependencies. No test runner exists
in the repo, so v1 ships without tests; pure helpers are structured to be
testable later.

## Error & edge handling

- Invalid org login shape → `notFound()` before any network call
- Org 404 → `not-found.tsx`
- HTTP 403/429 with `x-ratelimit-remaining: 0` → rate-limit error card with
  localized reset time
- Other non-OK → generic API error card with retry
- Open-count query failure → header omits open-issue count, page still renders

## Out of scope (YAGNI)

Pull requests, pagination beyond the 500-issue window, label-based filtering,
GitHub Enterprise, user auth, dark-mode toggle, tests.
