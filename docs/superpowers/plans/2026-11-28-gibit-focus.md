# Gibit Focus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-item next-action assessments written by Claude, a ranked Focus home page with an effort × impact filter, and keep the kanban as `/triage`.

**Architecture:** New `assessments` overlay table (1:1 with items). Pure scoring in `lib/focus.ts`. The service joins assessments into `ItemSummary`, adds `assessItems` (all-or-nothing batch), `focusItems`, `overrideAssessment`. MCP gains `assess_items` and a rewritten `triage` prompt. Dashboard: `/focus` (home), `/triage` (renamed board), drawer Assessment section.

**Tech Stack:** Existing (Next 16, Drizzle/Neon, mcp-handler v2, zod v4, Tailwind tokens).

**Spec:** `docs/superpowers/specs/2026-11-28-gibit-focus-design.md`

## Global Constraints

- All prior constraints (Bun, tokens only, no interpolated classes, strict TS, read-only GitHub, single service layer, `actor` on every write).
- Enums: next action `fix|review|reply|unblock|decide|close|wait`; effort `xs|s|m|l`; impact `low|med|high`; confidence `low|med|high`.
- Score `4·ease + 3·impact + 2·unblocks + 1·waiting`; ease `xs=3 s=2 m=1 l=0`; impact `high=3 med=2 low=1`; waiting 0–3 by days since a non-maintainer last spoke (<2→0, <5→1, <14→2, ≥14→3).
- `assess_items`: 1–25 entries, summary ≤ 200 chars, all-or-nothing on unknown refs.
- `/` → `/focus`; `/board` → `/triage`.

## Tasks

### Task 1: Model, schema, migration, pure focus helpers
- `lib/model.ts`: `NEXT_ACTIONS`, `EFFORTS`, `IMPACTS`, `CONFIDENCES` + types; `BlockedBy`.
- `lib/db/schema.ts`: `assessments` table; `activity_log.action` type adds `"assess"`.
- `bun run db:generate` → `drizzle/0001_*.sql`; `bun run db:migrate`.
- `lib/triage/types.ts`: `Assessment`; `ItemSummary.assessment`, `ItemSummary.needsAssessment`; fixtures updated.
- `lib/focus.ts` (+ tests): `needsAssessment`, `waitingScore`, `focusScore`, `quadrant`, `QUADRANT_LABELS`, `NEXT_ACTION_LABELS`, `rankFocus(items, owner, now)`.
- Commit `feat: add assessments model and focus scoring`.

### Task 2: Service + MCP
- Service: summaries left-join `assessments`; `assessItems(entries, actor)`; `focusItems()`; `overrideAssessment(ref, patch)`; `listItems` `needsAssessment` filter; `getItem` includes assessment; `getBriefing` adds `needsAssessment` + `focusTop`.
- MCP: `assess_items` tool; `list_items.needs_assessment`; rewritten `TRIAGE_PROMPT` with rubric and column mapping.
- Smoke script (not committed): batch assess 2 items, failing batch writes nothing, override, focus ranking; cleanup.
- curl: `assess_items` happy path + unknown ref error.
- Commit `feat: add assess_items tool and assessment service`.

### Task 3: Focus page, Triage rename, drawer assessment
- Move `app/(app)/board/*` → `app/(app)/triage/*`; `app/(app)/board/page.tsx` redirects to `/triage`; `/` → `/focus`; nav Focus · Triage · Reports · Settings.
- `app/(app)/focus/page.tsx` + `focus.tsx` (client): header + banner, matrix strip, action chips, waiting toggle, ranked rows, not-assessed section, drawer reuse.
- Drawer: Assessment section with override selects (`overrideAssessmentAction`).
- Triage cards: next-action badge + effort/impact.
- Verify `bun test`, `bunx tsc --noEmit`, `bun run build`, HTTP render checks.
- Commit `feat: add Focus page and move board to Triage`.
