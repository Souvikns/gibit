# Gibit v2 Board Implementation Plan (Plan 3 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The owner's dashboard: a kanban board of synced issues/PRs (drag on desktop, tabs + "Move to…" on mobile), an item drawer with thread, Claude's notes and draft reply, a Reports page, and a Sync button — all through the Plan 2 service layer with `actor: "admin"`.

**Architecture:** `/board` is a server component that loads board items via `boardItems()` and renders a client `Board` that filters in memory (repo, kind, priority) and groups by column with a pure helper. Moves call a server action → `moveItem(..., actor: "admin")` with optimistic UI. The drawer is driven by `?item=owner/repo#N`, fetching detail through a server action that also sets `seen_at`. `/reports` renders markdown with `react-markdown` + `remark-gfm` (no raw HTML).

**Tech Stack:** Next 16 server actions, `@dnd-kit/core`, `react-markdown@10`, `remark-gfm@4`, design.md tokens.

**Spec:** `docs/superpowers/specs/2026-11-26-gibit-v2-triage-design.md` ("Dashboard", "Board columns").

## Global Constraints

- Plan 1/2 constraints apply (tokens-only styling, no interpolated class names, inline SVG icons, strict TS).
- Board loads every non-`done` item plus `done` items updated in the last 14 days.
- Unseen activity = `updatedAt > seenAt` (or never seen). Opening the drawer sets `seen_at`.
- Dashboard moves require no typed reason; the action records reason `"moved on board"`.
- "Copy & open on GitHub" copies the draft, opens `htmlUrl` in a new tab, and marks the draft `copied`.
- `/` redirects to `/board`. Nav: Board, Reports, Settings.
- Mobile (< `md`): one column at a time via a horizontally scrollable tab strip; each card has a "Move to…" `<select>`. Desktop: all columns side by side, horizontal scroll, drag and drop.

## Tasks

### Task 1: Service + pure board helpers
- `ItemSummary` gains `seenAt: string | null`; fixtures updated.
- `lib/board.ts` (pure, tested): `COLUMN_LABELS`, `isUnseen(s)`, `filterBoard(items, { repo?, kind?, priority? })`, `groupByColumn(items) → Record<BoardColumn, ItemSummary[]>` (each column sorted: priority p0→p3→none, then updatedAt desc), `deriveRepoOptions(items)`.
- `lib/triage/service.ts`: `boardItems()`, `markSeen(ref)`, `markDraftCopied(ref)` (sets current draft → `copied`, logs `draft` activity with `{ status: "copied" }`).
- Commit `feat: add board helpers and service reads`.

### Task 2: Board page, cards, drag & drop, mobile tabs, sync button
- `app/(app)/board/page.tsx`, `board.tsx` (client), `card.tsx`, `actions.ts` (`moveItemAction`, `getItemAction`, `markDraftCopiedAction`, `syncStepAction` re-export), `components/icons.tsx` (+ `PullRequestIcon`, `MergedIcon`, `DotIcon`).
- Optimistic move with rollback + inline error on failure.
- `app/page.tsx` → `/board`; nav links.
- Commit `feat: add kanban board`.

### Task 3: Item drawer
- `drawer.tsx`: right-side panel (full-screen on mobile), opens from `?item=`; shows header (ref, state, author, labels, link), Move/priority controls, draft with Copy & open, Claude's notes, thread (markdown, maintainers highlighted), activity.
- `components/markdown.tsx`: token-styled element map.
- Commit `feat: add item drawer`.

### Task 4: Reports page + verification
- `app/(app)/reports/page.tsx`: newest first, title + time, markdown body; empty state explains `/mcp__gibit__triage`.
- Verify: `bun test`, `bunx tsc --noEmit`, `bun run build`; manual on dev server with a session cookie: board renders columns/counts, move persists across reload, drawer marks seen, reports render.
- Commit `feat: add reports page`.
