# Gibit v2 — Personal Triage Board for Maintainers + Claude

Date: 2026-11-26
Status: Draft (pending review)
Supersedes: [`2026-07-29-gibit-design.md`](./2026-07-29-gibit-design.md)

## Summary

Gibit becomes a self-hosted, single-owner triage board. The owner configures
GitHub repos in gibit; gibit syncs their issues and PRs (read-only) into
Postgres and shows them on a kanban board. Claude, running in Claude Code
(typically on the owner's server in tmux, driven from a phone via Remote
Control), connects to gibit over MCP, syncs, researches items, moves cards
between columns, writes notes and draft replies, and saves actionable reports.
The owner acts on GitHub themselves; the next sync picks that up and Claude
reconciles.

**Gibit never writes to GitHub.** Claude never writes to GitHub. All triage
state lives in gibit.

Open source, deployable to Vercel with one Deploy button.

### Reversals of the v1 spec

v1's out-of-scope list is intentionally reversed: v2 adds a database, auth,
pull requests and tests. The public landing page (`/`) and public org browser
(`/{org}`) are **removed** — a personal instance must not let strangers spend
the owner's `GITHUB_TOKEN` quota.

## Usage

1. Owner deploys via the Deploy button, logs in, adds repos in **Settings**.
2. Owner connects Claude Code once: `claude mcp add` with the gibit MCP URL and
   `GIBIT_SECRET` as a bearer header.
3. Daily: owner runs `/mcp__gibit__triage` (from the phone via Remote Control).
   Claude syncs, triages, and returns a report.
4. Owner acts on GitHub (replies, reviews, merges, closes), optionally using
   Claude's drafts via **Copy & open on GitHub**.
5. Owner can also open the dashboard any time to view the board and click
   **Sync**.

## Platform

- **Hosting:** Vercel (Hobby must work).
- **Database:** Neon Postgres via Vercel Marketplace, provisioned by the Deploy
  button. Env injected: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`.
- **ORM/migrations:** Drizzle ORM + `drizzle-kit`. Migrations run at build
  (`drizzle-kit migrate && next build`) using `DATABASE_URL_UNPOOLED`.
- **No cron.** Sync runs only from the MCP `sync` tool or the dashboard button.

### Environment variables (prompted by the Deploy button)

| Var | Purpose |
|---|---|
| `GITHUB_TOKEN` | Server-only. Read-only fine-grained PAT used for sync. Its `viewer` login is "the owner/me". |
| `ADMIN_PASSWORD` | Dashboard login. Also the key material for session signing. |
| `GIBIT_SECRET` | Bearer token for the MCP endpoint. |

To verify during implementation: whether the Deploy button parameter for Neon is
`stores=` or `products=` (docs conflict) — confirm with a test deploy.

## Auth

- **Dashboard:** `/login` form compares against `ADMIN_PASSWORD` with a
  constant-time comparison, then sets a signed session cookie (httpOnly,
  Secure, SameSite=Lax, 30 days, renewed on visit). The signing key is derived
  from `ADMIN_PASSWORD`, so changing the password invalidates all sessions.
  Logout clears the cookie. Failed logins are rate-limited via
  `login_attempts` (per IP, e.g. 5 per 15 min).
- **MCP:** `Authorization: Bearer <GIBIT_SECRET>`, constant-time comparison.
  Works with Claude Code (including Remote Control). Claude Desktop / mobile
  custom connectors require OAuth and are **out of scope for v1**; only the
  auth layer would change to add them later.
- `proxy.ts` (Next 16 middleware) redirects unauthenticated requests to
  `/login`, except `/login` and `/api/mcp/*` (which does its own bearer check).
  `/` redirects to `/board` (or `/login`).

## Data model

Two kinds of tables: a **mirror** written only by sync, and an **overlay**
written only by the owner and Claude. Re-sync never touches overlay data.

### Mirror

- **`repos`**: `id`, `owner`, `name`, `private`, `enabled`, `sync_cursor`
  (newest `updatedAt` seen), `backfilled_at`, `last_synced_at`, `last_error`,
  `created_at`. Configured only from the dashboard.
- **`items`**: GitHub node `id` (PK), `repo_id`, `kind` (`issue` | `pr`),
  `number`, `title`, `body`, `state` (`open` | `closed` | `merged`), `author`,
  `author_role`, `labels` (jsonb), `comments_count`, `reactions_count`,
  `created_at`, `updated_at`, `closed_at`, `merged_at`, `html_url`,
  `last_comment_by`, `last_comment_at`, `last_comment_is_maintainer`.
  PR-only: `is_draft`, `review_decision`, `requested_reviewers` (jsonb).
- **`comments`**: GitHub node `id` (PK), `item_id`, `author`, `author_role`,
  `kind` (`comment` | `review` | `review_comment`), `review_state`
  (`APPROVED` | `CHANGES_REQUESTED` | `COMMENTED` | null), `body`,
  `created_at`. Most recent 50 per item.
- **`mentions`**: `item_id`, `comment_id` (nullable = item body), `login`,
  `is_owner`, `is_maintainer`, `answered` (a maintainer commented after it).
  Computed on upsert.

**Maintainer** = `author_association` in `OWNER | MEMBER | COLLABORATOR`. No
configured list.

### Overlay

- **`triage`** (1:1 with item): `column`, `priority` (`p0`–`p3`, nullable),
  `last_reason`, `seen_at` (set only by the owner in the dashboard),
  `updated_at`.
- **`notes`**: `id`, `item_id`, `author` (`claude` | `admin`), `kind`
  (`research` | `note`), `body` (markdown), `created_at`.
- **`drafts`**: `id`, `item_id`, `body`, `status` (`draft` | `copied` |
  `discarded`), `created_by`, `created_at`, `updated_at`. One current draft per
  item; `save_draft` replaces it.
- **`reports`**: `id`, `title`, `body` (markdown), `created_at`.
- **`activity_log`**: `id`, `item_id` (nullable), `actor` (`claude` | `admin` |
  `sync`), `action` (`move` | `note` | `draft` | `report` | `sync`), `detail`
  (jsonb, e.g. from/to column + reason), `created_at`.

### Operational

- **`sync_runs`**: `id`, `trigger` (`mcp` | `dashboard`), `status` (`running` |
  `partial` | `done` | `failed`), `repos_total`, `repos_done`, `counts` (jsonb),
  `error`, `rate_limit_reset_at`, `heartbeat_at`, `started_at`, `finished_at`.
  Doubles as a lock.
- **`app_state`**: key/value — `owner_login`, `last_briefing_at`.
- **`login_attempts`**: `ip`, `count`, `window_start`.

**Unseen activity** (dashboard badge) = `items.updated_at > triage.seen_at`.
Computed, not stored.

## Board columns

| Column | Meaning |
|---|---|
| `inbox` | New or reopened, not yet triaged |
| `needs_reply` | Owner owes a response |
| `needs_review` | PR awaiting the owner's review |
| `investigating` | Claude researching / needs a closer look |
| `waiting` | Ball is with author, contributor, or another maintainer |
| `ready` | Ready to close (duplicate/stale/answered) or merge (approved) |
| `done` | Closed or merged |

## Sync

Shared `runSync({ trigger, repos? })` called by the MCP tool and the dashboard.

1. **Lock.** If a `sync_runs` row is `running` with a heartbeat < 10 min old,
   return its progress instead of starting. A stale lock is taken over.
2. **Per repo**, one GitHub GraphQL query (paginated) fetches:
   - issues with `filterBy: { since: cursor }`
   - PRs ordered `UPDATED_AT DESC`, paging until older than the cursor
   - per item: last 50 comments, reviews, review requests
3. **Backfill** (repo with no `backfilled_at`): all open items + items closed or
   merged in the last 90 days.
4. **Upsert** by node id (idempotent). Advance the repo's `sync_cursor` only
   after that repo succeeds. Recompute `mentions`.
5. **Mechanical column rules** (pure, `lib/sync/rules.ts`), the only moves sync
   makes; logged with `actor: sync`:
   - new item → `inbox`
   - closed/merged → `done`
   - reopened (was `done`, now open) → `inbox`
6. **Errors are per repo**: stored on `repos.last_error`, run continues.
7. **Time budget.** Each invocation works ~45 s, then persists progress and
   returns `{ status: "partial", repos_done, repos_total }`. Dashboard
   re-invokes automatically with a progress bar; the MCP tool description tells
   Claude to call again until `done`.
8. **Rate limit.** Read GraphQL `rateLimit { remaining resetAt }`. Below a
   threshold (e.g. 200), stop as `partial` and record `rate_limit_reset_at`.

Accepted v1 limits: threads keep the latest 50 comments; deleted/transferred
items remain as last seen.

## MCP server

`app/api/mcp/[transport]/route.ts` using `mcp-handler`, bearer-authenticated.
Items are referenced as `owner/repo#number`. Tools are thin wrappers over the
shared service layer (`lib/triage`), the same one the dashboard uses.

### Read tools

- **`sync({ repos? })`** — run/continue a sync; returns progress.
- **`list_repos()`** — configured repos: `owner/name`, `clone_url`,
  `default_branch`, sync status, `last_error`. Claude uses this to know which
  repos to clone/pull locally.
- **`get_briefing({ since? })`** — "catch me up". Default `since` =
  `app_state.last_briefing_at`; updates it on return. Returns: new items;
  threads where a non-maintainer spoke last; PRs requesting the owner's review;
  unanswered mentions of the owner or maintainers; approved-but-unmerged PRs;
  items whose column changed.
- **`list_items({ repo?, kind?, column?, priority?, needs_reply?, mentions_me?,
  review_requested?, limit? })`**
- **`get_item({ ref })`** — item + full stored thread + triage + notes + draft
  + item activity.
- **`list_reports({ limit? })`**

### Write tools (gibit only)

- **`move_item({ ref, column, reason, priority? })`** — `reason` required;
  shown on the card and logged.
- **`add_note({ ref, body, kind })`**
- **`save_draft({ ref, body })`**
- **`save_report({ title, body })`**

Claude cannot add/remove repos or set `seen_at`.

### MCP prompt: `triage`

Shipped in the repo so every deploy gets it; appears in Claude Code as
`/mcp__gibit__triage`. Playbook:

1. `sync` until done.
2. `list_repos`; ensure a local clone of each and `git pull` (Claude's
   working directory; gibit is not involved).
3. `get_briefing`.
4. For every `inbox` item and every item with new activity: `get_item`,
   research in the local clone, `move_item` with a reason, `add_note`
   (research), `save_draft` when the owner should reply.
5. Reconcile earlier decisions with new activity, e.g. author replied on a
   `waiting` item → `needs_reply`; owner commented on a `needs_reply` item →
   `waiting`; owner reviewed → leave `needs_review`.
6. `save_report` grouped by action — reply (drafts ready), review, close/merge,
   ping someone, FYI — with links; also post the report in chat.
7. Never write to GitHub.

## Dashboard

All routes behind the session. Visual design uses `design.md` tokens
(existing Tailwind v4 `@theme`); mobile-responsive.

- **`/login`** — password form.
- **`/board`** — kanban.
  - Header: **Sync** button + progress bar + "last synced X ago"; filters:
    repo, kind, priority.
  - Card: repo#number, title, issue/PR icon, author, age, `last_reason`;
    badges: unseen activity, review requested, @you mentioned, draft ready,
    priority.
  - Desktop: drag between columns (`@dnd-kit`). Mobile: columns as swipeable
    tabs + per-card "Move to…" menu. Owner moves are logged (`actor: admin`).
- **Item drawer** (opens from a card; sets `seen_at`): thread with maintainers
  highlighted, Claude's notes, current draft with **Copy & open on GitHub**
  (copies, opens `html_url`, marks draft `copied`), item activity log.
- **`/reports`** — newest first, markdown rendered, item links open the drawer.
- **`/settings`**
  - Repos: add single (`owner/name`), "add all from org/user" (checkbox list),
    remove, enable/disable; per-repo sync status + last error.
  - Connect Claude: MCP URL + copyable `claude mcp add` command (secret shown
    as a placeholder, never the value).

## Architecture

```
lib/db/          schema.ts, client.ts
lib/github/      graphql.ts (client + GitHubError), queries.ts,
                 map.ts (pure: GraphQL → rows, mention detection)
lib/sync/        run.ts (lock, budget, per-repo loop), rules.ts (pure)
lib/triage/      items, move, notes, drafts, reports, briefing — shared service layer
lib/auth/        session.ts (signed cookie), bearer.ts
app/api/mcp/[transport]/route.ts
app/(app)/board, reports, settings — server actions call lib/triage
app/login/
proxy.ts
```

- New dependencies: `@neondatabase/serverless`, `drizzle-orm`, `drizzle-kit`,
  `mcp-handler`, `zod`, `react-markdown` (+ sanitization), `@dnd-kit/core`.
- GitHub access stays plain `fetch` (no Octokit). Icons stay inline SVG.
- Existing conventions hold: named design tokens only, no interpolated class
  names, `isValidLogin` before network calls, strict TS.
- Removed: `app/page.tsx` landing, `components/landing/*`, `app/[org]/*`,
  search-API code in `lib/github.ts`.

## Error handling

- `GitHubError` keeps `kind: "not-found" | "rate-limited" | "api"`; GraphQL
  `errors` in a 200 response map to `api`.
- Sync: per-repo failures isolated; rate limit ends the run `partial` with the
  reset time.
- MCP tools return `isError` with a readable message (e.g. "unknown ref
  asyncapi/cli#9", "sync already running: 3/12 repos done").
- Dashboard actions show inline errors; failed logins rate-limited.

## Testing

- `bun test` for pure logic: GraphQL → row mapping, mention detection and
  `answered`, mechanical column rules, briefing selection, cookie sign/verify,
  ref parsing.
- Manual end-to-end checklist in the README: Deploy button → login → add repos
  → dashboard sync → `claude mcp add` → `/mcp__gibit__triage` → report appears
  → act on GitHub → re-sync → Claude reconciles.

## Out of scope (v1 of the v2)

Writing to GitHub (comments, labels, closing, merging); OAuth / Claude Desktop
and mobile connectors; cron or webhooks; CI status on PRs; multi-user;
full-history backfill; GitHub Enterprise; dark mode.
