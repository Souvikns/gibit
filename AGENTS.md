# AGENTS.md

gibit v2: a single-owner, self-hosted triage board (Next.js 16 + Tailwind v4 +
Neon Postgres) that syncs issues/PRs from configured repos and exposes them to
Claude over MCP. Spec: `docs/superpowers/specs/2026-11-26-gibit-v2-triage-design.md`.

## Commands

- Package manager is **Bun**. `bun install`, `bun run dev`, `bun run build`
  (runs migrations first; skipped when no DB URL).
- No linter/formatter. Verify with `bun test`, `bunx tsc --noEmit`,
  `bun run build`. Don't add lint config unasked.
- Schema change → `bun run db:generate`, commit `drizzle/`, `bun run db:migrate`.
- `bun scripts/sync.ts` runs a full sync from the CLI (uses `.env.local`).

## Design system

- `design.md` is the visual source of truth; tokens live in `app/globals.css`
  `@theme`. Use named tokens only (`text-body-sm`, `text-ink`, `bg-surface`,
  `border-hairline`, `rounded-md`…), never default palette or arbitrary values.
- No `tailwind.config.js`. Never interpolate class names.
- Icons: inline SVG in `components/icons.tsx`; no icon library.

## Architecture

- **GitHub is read-only.** Nothing writes to GitHub. Sync uses GraphQL via
  plain `fetch` (`lib/github/graphql.ts`).
- **Mirror vs overlay.** `repos/items/comments/mentions` are written only by
  sync. `triage/notes/drafts/reports/activity_log` are written only by the
  owner and Claude. Sync's only overlay writes are the mechanical column moves
  in `lib/sync/rules.ts`.
- **Sync is resumable**: `syncStep()` (`lib/sync/run.ts`) works ~45 s, stores
  per-repo position in `repos.sync_state`, and returns `partial`; callers
  re-invoke until `done`.
- **Auth**: `proxy.ts` gates everything except `/login` and `/api/mcp` with a
  signed cookie (`lib/auth/session.ts`). Server actions call
  `requireSession()` first.
- **One service layer**: MCP tools (`lib/mcp/server.ts`) and dashboard server
  actions both call `lib/triage/service.ts`; never write overlay tables
  directly from routes or components. MCP writes use `actor: "claude"`, the
  dashboard uses `actor: "admin"`.
- **Assessments** (`assessments` table) drive the Focus page; scoring and
  quadrants are pure helpers in `lib/focus.ts`. Pages: `/focus` (home),
  `/triage` (kanban; `/board` redirects), `/reports`, `/settings`.
- MCP endpoint is `/api/mcp` (`mcp-handler` v2 + `withMcpAuth`, bearer
  `GIBIT_SECRET`). The `triage` prompt lives in `lib/mcp/prompt.ts`.
- Pure logic (`lib/model.ts`, `lib/github/map.ts`, `lib/github/names.ts`,
  `lib/sync/rules.ts`, `lib/sync/plan.ts`, `lib/auth/session.ts`,
  `lib/auth/rate-limit.ts`, `lib/triage/{refs,signals,briefing}.ts`, `lib/focus.ts`,
  `lib/time.ts`, `lib/labels.ts`) is unit-tested and
  must stay free of DB/network access.
- `db()` is lazy; never touch the DB at module top level.
- Path alias `@/*` → repo root. tsconfig is extra strict
  (`noUncheckedIndexedAccess`).
