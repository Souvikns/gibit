# Gibit Focus — Next-Action Assessments

Date: 2026-11-28
Status: Approved (brainstorm), pending spec review
Builds on: [`2026-11-26-gibit-v2-triage-design.md`](./2026-11-26-gibit-v2-triage-design.md)

## Summary

Gibit moves from a status board to a next-action board. When the owner runs
Claude, Claude writes a structured **assessment** per item — what to do next,
effort, impact, who it's blocked by and what to ask them. A new **Focus** page
(the home screen) ranks open items by what will get them moving fastest, with
an effort × impact matrix that filters the list. The kanban stays as a
secondary **Triage** page that Claude keeps current.

## Decisions

- **Home = Focus** (matrix strip filtering a ranked list). Full-page matrix
  ("Map") is out of scope for now.
- **Ranking priorities, in order:** ease → impact → unblocks others → waiting
  time.
- **Kanban kept** as `/triage`, updated by Claude on every run, not the first
  view.
- **Assessment happens only when Claude runs** (Claude Code, `triage` prompt).
  The dashboard Sync button fetches data only; new/changed items show as "not
  assessed". No server-side LLM.
- **Storage:** new 1:1 `assessments` table (current state only; history via
  `activity_log`).

## Data model

### `assessments` (overlay; written by Claude, overridable by the owner)

| Column | Type | Notes |
|---|---|---|
| `item_id` | text PK → `items.id` ON DELETE CASCADE | pruned with its item |
| `summary` | text not null | one-line TL;DR (≤ 200 chars enforced by the tool) |
| `next_action` | text not null | `fix` · `review` · `reply` · `unblock` · `decide` · `close` · `wait` |
| `effort` | text not null | `xs` · `s` · `m` · `l` |
| `impact` | text not null | `low` · `med` · `high` |
| `unblocks_others` | boolean not null default false | |
| `blocked_by` | jsonb null | `{ login: string; reason: string; ask: string }` |
| `why_now` | text null | |
| `confidence` | text not null | `low` · `med` · `high` |
| `assessed_by` | text not null | `claude` · `admin` |
| `item_updated_at` | timestamptz not null | the item's `updated_at` at assessment time |
| `assessed_at` | timestamptz not null default now() | |

Replies stay in `drafts` (`save_draft`). The ask to a blocker lives in
`blocked_by.ask`. No message field on the assessment.

### Derived (pure helpers in `lib/focus.ts`, unit-tested)

- `needsAssessment(item, assessment)` — no assessment, or
  `item.updatedAt > assessment.itemUpdatedAt`.
- `waitingScore(item, owner, now)` — 0 unless the item is open and a
  non-maintainer spoke last (`needsReply`); then by days since
  `lastCommentAt ?? createdAt`: < 2d → 0, < 5d → 1, < 14d → 2, ≥ 14d → 3.
- `focusScore(assessment, waiting)` =
  `4·ease + 3·impact + 2·unblocks + 1·waiting`, with ease `xs=3 s=2 m=1 l=0`,
  impact `high=3 med=2 low=1`, unblocks `1|0`.
- `quadrant(assessment)` — `quick_wins` (impact med/high, effort xs/s),
  `big_bets` (med/high, m/l), `fill_ins` (low, xs/s), `ignore` (low, m/l).

## MCP

- **New `assess_items({ assessments })`** — 1–25 entries:
  `{ ref, summary, next_action, effort, impact, unblocks_others?, blocked_by?, why_now?, confidence }`.
  Validates all refs first; on any unknown ref, writes nothing and returns an
  error naming the failing refs. Upserts each assessment with
  `assessed_by: "claude"` and `item_updated_at` = the item's current
  `updated_at`; appends `activity_log` (`action: "assess"`).
- **`list_items`** gains `needs_assessment?: boolean`.
- **`get_item`** includes `assessment`.
- **`get_briefing`** gains `needsAssessment: number` and `focusTop: ItemSummary[]` (top 5 by score).
- `ItemSummary` gains `assessment: Assessment | null`, `needsAssessment: boolean`.

### `triage` prompt (rewritten)

1. `sync` until done.
2. `list_repos`; clone/pull each.
3. `list_items({ needs_assessment: true, limit: 200 })`; for each: `get_item`,
   research in the clone, then assess. Batch writes via `assess_items`.
   Rubric:
   - effort **xs** < 30 min, one place, location known · **s** < half a day ·
     **m** a day or two / several files / needs design · **l** larger or unclear.
   - impact **high** = broken for many users, regression, security, release
     blocker · **med** = real bug or valuable feature for some users · **low** =
     cosmetic, niche, nice-to-have.
   - next action: `fix` (owner can just fix it), `review` (PR needs owner
     review), `reply` (owner owes a response), `unblock` (someone else must act —
     fill `blocked_by` with who, why, and the exact ask), `decide` (needs
     owner's judgment), `close` (duplicate/stale/answered/merged-elsewhere),
     `wait` (ball is with someone, nothing to do yet).
   - `unblocks_others` when the owner's action frees someone else's work.
   - `why_now` one short line; `confidence` honest.
4. Update Triage columns with `move_item`: `close` → `ready`, `reply`/`decide`
   → `needs_reply`, `review` → `needs_review`, `fix` → `investigating`,
   `wait`/`unblock` → `waiting`.
5. `save_draft` for replies the owner should post.
6. `save_report`, leading with the Focus top 5, then Unblock asks grouped by
   person.
7. Never write to GitHub.

## Dashboard

- `/` → `/focus`. Nav: **Focus · Triage · Reports · Settings**. `/board` →
  `/triage` (redirect from `/board`).
- **Focus page**
  1. Header: title, last sync, Sync button (fetch only). Banner when
     `needsAssessment > 0`: "N items need assessment — run
     `/mcp__gibit__triage` in Claude Code."
  2. Matrix strip: 2×2 counts (Quick wins, Big bets, Fill-ins, Ignore for now);
     tap to filter, tap again to clear; chips on mobile.
  3. Action chips: All · Fix · Unblock · Review · Reply · Decide · Close;
     `wait` items hidden behind a "Waiting (N)" toggle.
  4. "Do next" list: open, assessed items ranked by `focusScore` desc
     (ties: `updatedAt` desc). Row: action badge, ref, effort · impact,
     summary, `why_now`, blocker line with **Copy** for the ask, "draft ready",
     "unsure" when confidence is low, "changed since assessed" when stale.
  5. Collapsed "Not assessed (N)" section with plain rows.
  - Rows open the existing drawer.
- **Drawer** gains an Assessment section at the top (summary, next action,
  effort, impact, blocker, why now, assessed by/when) with selects to override
  next action / effort / impact → saved as `assessed_by: "admin"`,
  `item_updated_at` = current item `updated_at`.
- **Triage page** = current kanban; cards show the next-action badge and
  effort/impact when assessed.

## Service

`lib/triage/service.ts` gains `assessItems(entries, actor)`, `focusItems()`
(open items + assessments + flags), and `overrideAssessment(ref, patch)`.
Summaries join `assessments`. All writes go through the service and log to
`activity_log`.

## Testing

- `bun test`: `lib/focus.ts` (score, quadrant, needsAssessment, waiting).
- Smoke script against the dev DB for `assessItems` (incl. all-or-nothing
  failure), `focusItems`, `overrideAssessment`.
- curl MCP: `assess_items` happy path + unknown ref.
- HTTP render checks for `/focus`, `/triage`, `/board` redirect.

## Out of scope

Full-page matrix ("Map"), People view, server-side assessment via the Claude
API, `gh` batch commands, per-repo weighting.
