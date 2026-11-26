# Gibit v2 Foundation Implementation Plan (Plan 1 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace gibit's public issue browser with a password-protected, single-owner app that stores configured repos in Neon Postgres and syncs their issues and PRs (read-only, via GitHub GraphQL) on demand from a Settings page.

**Architecture:** Drizzle ORM over Neon's HTTP driver holds a *mirror* (repos, items, comments, mentions) written only by sync and an *overlay* (triage, notes, drafts, reports, activity log) created here but filled by Plans 2–3. Auth is a signed session cookie checked in `proxy.ts`. Sync is a resumable, time-budgeted `syncStep()` that walks per-repo phases and persists its position, so callers re-invoke until `done`.

**Tech Stack:** Next.js 16 (App Router, server actions, `proxy.ts`), React 19, Tailwind v4 (design.md tokens), Bun (package manager + `bun test`), Neon Postgres, `drizzle-orm` + `drizzle-kit`, GitHub GraphQL API via plain `fetch`, Web Crypto.

**Spec:** `docs/superpowers/specs/2026-11-26-gibit-v2-triage-design.md`

**Follow-up plans (not this one):** Plan 2 — shared triage service + MCP server + `triage` prompt + "Connect Claude" settings section. Plan 3 — kanban board, item drawer, reports page, `/` → `/board`.

## Global Constraints

- Package manager is Bun: `bun add`, `bun run`, `bun test`. No linter/formatter; do not add one.
- Verify every task with `bun test`, `bunx tsc --noEmit` (strict, `noUncheckedIndexedAccess`), and — where the task says so — `bun run build`.
- Styling: only design.md tokens from `app/globals.css` (`text-body-sm`, `text-heading-4`, `text-ink`, `text-slate`, `text-stone`, `bg-canvas`, `bg-surface`, `border-hairline`, `rounded-md`, `bg-primary`, `text-on-primary`, `text-semantic-error`, `text-semantic-success`, `text-link-blue`, …). Never `text-sm`, `text-gray-*`, or arbitrary colors. Never interpolate class names.
- No `tailwind.config.js`. Icons are inline SVG in `components/icons.tsx`; no icon library.
- Path alias `@/*` → repo root.
- GitHub access is plain `fetch` (no Octokit) and **read-only**. Nothing in gibit writes to GitHub.
- Env vars: `GITHUB_TOKEN` (server-only, read-only fine-grained PAT), `ADMIN_PASSWORD`, `GIBIT_SECRET` (used in Plan 2), `DATABASE_URL`, `DATABASE_URL_UNPOOLED` (injected by Neon).
- Session cookie: httpOnly, Secure (in production), SameSite=Lax, 30 days, renewed on visit; signing key derived from `ADMIN_PASSWORD`.
- Login rate limit: 5 failed attempts per IP per 15 minutes.
- Backfill window: all open items + items updated in the last 90 days. Threads keep the latest 50 comments.
- Sync time budget: ~45 s per invocation; stop as `partial` when GraphQL `rateLimit.remaining` < 200.
- Maintainer = `author_association` in `OWNER | MEMBER | COLLABORATOR` (plus the owner login).
- Board columns: `inbox`, `needs_reply`, `needs_review`, `investigating`, `waiting`, `ready`, `done`.

## Prerequisites (once, before Task 2)

1. Create a Neon project (free tier) for development. Copy its pooled and direct connection strings.
2. Create a fine-grained GitHub PAT with **read-only** access to Issues, Pull requests, and Metadata on the repos you'll test with.
3. Create `.env.local` (gitignored):

```bash
DATABASE_URL=postgres://...pooled...
DATABASE_URL_UNPOOLED=postgres://...direct...
GITHUB_TOKEN=github_pat_...
ADMIN_PASSWORD=dev-password
GIBIT_SECRET=dev-secret
```

Bun loads `.env.local` automatically for `bun run`, `bun test`, and `bun <script>`.

## File Structure

```
lib/model.ts                 Domain types + constants shared by DB, mapper, rules (pure)
lib/labels.ts (+test)        labelTint moved from lib/issues.ts
lib/db/schema.ts             All v2 tables (mirror, overlay, operational)
lib/db/client.ts             Lazy Drizzle/Neon client: db()
lib/db/upsert.ts             excludedSet() helper for multi-row upserts
scripts/migrate.ts           Applies drizzle/ migrations (skips when no DB URL)
drizzle.config.ts            drizzle-kit config
drizzle/                     Generated SQL migrations (committed)
lib/auth/session.ts (+test)  signSession / verifySession / shouldRenew / safeEqual / safeNextPath (Web Crypto, pure)
lib/auth/rate-limit.ts (+test) isBlocked / recordFailure (pure)
lib/auth/attempts.ts         login_attempts persistence
lib/auth/server.ts           setSessionCookie / clearSessionCookie / requireSession (next/headers)
proxy.ts                     Redirect to /login without a valid session; renew cookie
app/login/page.tsx, login-form.tsx, actions.ts
app/(app)/layout.tsx         Authenticated shell (nav + logout)
app/(app)/actions.ts         logout
components/app-nav.tsx
lib/github/names.ts (+test)  isValidLogin / isValidRepoName / parseRepoFullName (pure)
lib/github/graphql.ts (+test) graphql() client + GitHubError
lib/github/queries.ts        GraphQL query strings + raw response types
lib/github/map.ts (+test)    mapIssue / mapPullRequest / extractMentions (pure)
lib/github/owner.ts          getOwnerLogin() cached in app_state
lib/repos.ts                 Repo configuration service
lib/sync/rules.ts (+test)    mechanicalMove (pure)
lib/sync/plan.ts (+test)     initialRepoState / advanceRepoState (pure)
lib/sync/fetch-page.ts       One GraphQL page for a repo phase
lib/sync/store.ts            Persist a mapped page (items, comments, mentions, triage moves)
lib/sync/run.ts              syncStep() — lock/claim, budget, per-repo loop
scripts/sync.ts              Dev helper: loop syncStep until done
app/(app)/settings/page.tsx, actions.ts, repo-forms.tsx, sync-panel.tsx
README.md, AGENTS.md, .env.example, .gitignore
```

---

### Task 1: Remove the v1 public surface

**Files:**
- Delete: `app/[org]/` (whole directory), `components/landing/` (whole directory), `components/org-shell.tsx`, `lib/constants.ts`, `lib/filters.ts`, `lib/filters.test.ts`, `lib/issues.ts`, `lib/issues.test.ts`, `lib/github.ts`
- Create: `lib/labels.ts`, `lib/labels.test.ts`
- Modify: `app/page.tsx` (replace), `app/layout.tsx` (metadata)

**Interfaces:**
- Produces: `labelTint(hex: string): { background: string; color: string }` in `lib/labels.ts`; `/` redirects to `/settings` (Plan 3 changes it to `/board`).

- [ ] **Step 1: Write the labelTint test in its new home**

`lib/labels.test.ts`:
```ts
import { expect, test } from "bun:test";
import { labelTint } from "./labels";

test("labelTint derives a readable tint from the label's real color", () => {
  expect(labelTint("ff0000")).toEqual(labelTint("#ff0000"));
  const tint = labelTint("ff0000");
  expect(tint.background).toBe("rgb(255, 219, 219)");
  expect(tint.color).toBe("rgb(166, 0, 0)");
});

test("labelTint tolerates short or invalid hex", () => {
  expect(labelTint("zz").background).toBe("rgb(219, 219, 219)");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun test lib/labels.test.ts`
Expected: FAIL — `Cannot find module './labels'`.

- [ ] **Step 3: Create `lib/labels.ts`**

```ts
/**
 * Derives a readable chip tint from a label's real GitHub hex color
 * so a label's chip reflects how it's colored in the source repo.
 */
export function labelTint(hex: string): { background: string; color: string } {
  const clean = hex.replace(/^#/, "").padStart(6, "0");
  const r = parseInt(clean.slice(0, 2), 16) || 0;
  const g = parseInt(clean.slice(2, 4), 16) || 0;
  const b = parseInt(clean.slice(4, 6), 16) || 0;
  const mix = (channel: number, target: number, ratio: number) =>
    Math.round(channel * (1 - ratio) + target * ratio);
  const background = `rgb(${mix(r, 255, 0.86)}, ${mix(g, 255, 0.86)}, ${mix(b, 255, 0.86)})`;
  const color = `rgb(${mix(r, 0, 0.35)}, ${mix(g, 0, 0.35)}, ${mix(b, 0, 0.35)})`;
  return { background, color };
}
```

- [ ] **Step 4: Delete the v1 files**

```bash
git rm -r -q "app/[org]" components/landing components/org-shell.tsx lib/constants.ts lib/filters.ts lib/filters.test.ts lib/issues.ts lib/issues.test.ts lib/github.ts
```

- [ ] **Step 5: Replace `app/page.tsx`**

```tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/settings");
}
```

- [ ] **Step 6: Update metadata in `app/layout.tsx`**

Replace the `metadata` export with:
```ts
export const metadata: Metadata = {
  title: "gibit",
  description: "A personal triage board for maintainers, shared with Claude.",
};
```

- [ ] **Step 7: Verify**

Run: `bun test && bunx tsc --noEmit && bun run build`
Expected: tests PASS (labels, time); tsc clean; build succeeds (only `/` and `/_not-found`).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor: remove v1 public landing and org browser"
```

---

### Task 2: Domain model, database schema, migrations

**Files:**
- Create: `lib/model.ts`, `lib/db/schema.ts`, `lib/db/client.ts`, `lib/db/upsert.ts`, `drizzle.config.ts`, `scripts/migrate.ts`, `drizzle/` (generated), `.env.example`
- Modify: `package.json` (deps + scripts), `.gitignore`

**Interfaces:**
- Produces (`lib/model.ts`): `COLUMNS`, `BoardColumn`, `ItemKind`, `ItemState`, `Priority`, `CommentKind`, `Actor`, `SyncTrigger`, `SyncStatus`, `SyncPhase`, `RepoSyncState`, `Label`, `isMaintainerRole(role: string): boolean`.
- Produces (`lib/db/schema.ts`): tables `repos`, `items`, `comments`, `mentions`, `triage`, `notes`, `drafts`, `reports`, `activityLog`, `syncRuns`, `appState`, `loginAttempts`.
- Produces: `db()` from `lib/db/client.ts`; `excludedSet(table, skip)` from `lib/db/upsert.ts`.

- [ ] **Step 1: Install dependencies**

```bash
bun add drizzle-orm @neondatabase/serverless
bun add -d drizzle-kit
```

- [ ] **Step 2: Write the model test**

`lib/model.test.ts`:
```ts
import { expect, test } from "bun:test";
import { COLUMNS, isMaintainerRole } from "./model";

test("board columns are in display order", () => {
  expect(COLUMNS).toEqual(["inbox", "needs_reply", "needs_review", "investigating", "waiting", "ready", "done"]);
});

test("isMaintainerRole accepts OWNER, MEMBER, COLLABORATOR only", () => {
  expect(isMaintainerRole("OWNER")).toBe(true);
  expect(isMaintainerRole("MEMBER")).toBe(true);
  expect(isMaintainerRole("COLLABORATOR")).toBe(true);
  expect(isMaintainerRole("CONTRIBUTOR")).toBe(false);
  expect(isMaintainerRole("NONE")).toBe(false);
});
```

Run: `bun test lib/model.test.ts` — Expected: FAIL (module missing).

- [ ] **Step 3: Create `lib/model.ts`**

```ts
export const COLUMNS = [
  "inbox",
  "needs_reply",
  "needs_review",
  "investigating",
  "waiting",
  "ready",
  "done",
] as const;
export type BoardColumn = (typeof COLUMNS)[number];

export type ItemKind = "issue" | "pr";
export type ItemState = "open" | "closed" | "merged";
export type Priority = "p0" | "p1" | "p2" | "p3";
export type CommentKind = "comment" | "review" | "review_comment";
export type Actor = "claude" | "admin" | "sync";
export type SyncTrigger = "mcp" | "dashboard";
export type SyncStatus = "running" | "partial" | "done" | "failed";

/** Ordered sync phases for one repo. Backfill runs all four; incremental runs the last of each kind. */
export type SyncPhase = "issues-open" | "issues-since" | "prs-open" | "prs-recent";

/** Persisted position of an in-progress repo sync, so a time-budgeted step can resume. */
export interface RepoSyncState {
  backfill: boolean;
  phase: SyncPhase;
  /** GraphQL endCursor for the current phase; null = first page. */
  after: string | null;
  /** ISO lower bound: now-90d during backfill, else the repo's sync cursor. Null = unbounded. */
  since: string | null;
  /** Newest updatedAt seen so far in this repo sync (ISO). */
  maxUpdatedAt: string | null;
}

export interface Label {
  name: string;
  color: string;
}

const MAINTAINER_ROLES: ReadonlySet<string> = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);

export function isMaintainerRole(role: string): boolean {
  return MAINTAINER_ROLES.has(role);
}
```

Run: `bun test lib/model.test.ts` — Expected: PASS.

- [ ] **Step 4: Create `lib/db/schema.ts`**

```ts
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type {
  Actor,
  BoardColumn,
  CommentKind,
  ItemKind,
  ItemState,
  Label,
  Priority,
  RepoSyncState,
  SyncStatus,
  SyncTrigger,
} from "@/lib/model";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

// ---------- Mirror (written only by sync) ----------

export const repos = pgTable(
  "repos",
  {
    id: serial("id").primaryKey(),
    owner: text("owner").notNull(),
    name: text("name").notNull(),
    private: boolean("private").notNull().default(false),
    defaultBranch: text("default_branch").notNull().default("main"),
    enabled: boolean("enabled").notNull().default(true),
    syncCursor: ts("sync_cursor"),
    backfilledAt: ts("backfilled_at"),
    syncState: jsonb("sync_state").$type<RepoSyncState | null>(),
    lastSyncedAt: ts("last_synced_at"),
    lastError: text("last_error"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("repos_owner_name").on(t.owner, t.name)],
);

export const items = pgTable(
  "items",
  {
    id: text("id").primaryKey(), // GitHub node id
    repoId: integer("repo_id")
      .notNull()
      .references(() => repos.id, { onDelete: "cascade" }),
    kind: text("kind").$type<ItemKind>().notNull(),
    number: integer("number").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    state: text("state").$type<ItemState>().notNull(),
    author: text("author").notNull(),
    authorRole: text("author_role").notNull(),
    labels: jsonb("labels").$type<Label[]>().notNull().default([]),
    commentsCount: integer("comments_count").notNull().default(0),
    reactionsCount: integer("reactions_count").notNull().default(0),
    createdAt: ts("created_at").notNull(),
    updatedAt: ts("updated_at").notNull(),
    closedAt: ts("closed_at"),
    mergedAt: ts("merged_at"),
    htmlUrl: text("html_url").notNull(),
    lastCommentBy: text("last_comment_by"),
    lastCommentAt: ts("last_comment_at"),
    lastCommentIsMaintainer: boolean("last_comment_is_maintainer").notNull().default(false),
    isDraft: boolean("is_draft").notNull().default(false),
    reviewDecision: text("review_decision"),
    requestedReviewers: jsonb("requested_reviewers").$type<string[]>().notNull().default([]),
  },
  (t) => [
    uniqueIndex("items_repo_number").on(t.repoId, t.number),
    index("items_updated_at").on(t.updatedAt),
  ],
);

export const comments = pgTable(
  "comments",
  {
    id: text("id").primaryKey(), // GitHub node id
    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    author: text("author").notNull(),
    authorRole: text("author_role").notNull(),
    kind: text("kind").$type<CommentKind>().notNull(),
    reviewState: text("review_state"),
    body: text("body").notNull().default(""),
    createdAt: ts("created_at").notNull(),
  },
  (t) => [index("comments_item_id").on(t.itemId)],
);

export const mentions = pgTable(
  "mentions",
  {
    id: serial("id").primaryKey(),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    commentId: text("comment_id"), // null = item body
    login: text("login").notNull(),
    isOwner: boolean("is_owner").notNull(),
    isMaintainer: boolean("is_maintainer").notNull(),
    answered: boolean("answered").notNull(),
    createdAt: ts("created_at").notNull(),
  },
  (t) => [index("mentions_item_id").on(t.itemId)],
);

// ---------- Overlay (written by owner and Claude) ----------

export const triage = pgTable("triage", {
  itemId: text("item_id")
    .primaryKey()
    .references(() => items.id, { onDelete: "cascade" }),
  column: text("column").$type<BoardColumn>().notNull(),
  priority: text("priority").$type<Priority>(),
  lastReason: text("last_reason"),
  seenAt: ts("seen_at"),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const notes = pgTable("notes", {
  id: serial("id").primaryKey(),
  itemId: text("item_id")
    .notNull()
    .references(() => items.id, { onDelete: "cascade" }),
  author: text("author").$type<"claude" | "admin">().notNull(),
  kind: text("kind").$type<"research" | "note">().notNull(),
  body: text("body").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const drafts = pgTable("drafts", {
  id: serial("id").primaryKey(),
  itemId: text("item_id")
    .notNull()
    .references(() => items.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  status: text("status").$type<"draft" | "copied" | "discarded">().notNull().default("draft"),
  createdBy: text("created_by").$type<"claude" | "admin">().notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const reports = pgTable("reports", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const activityLog = pgTable(
  "activity_log",
  {
    id: serial("id").primaryKey(),
    itemId: text("item_id").references(() => items.id, { onDelete: "cascade" }),
    actor: text("actor").$type<Actor>().notNull(),
    action: text("action").$type<"move" | "note" | "draft" | "report" | "sync">().notNull(),
    detail: jsonb("detail").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("activity_log_item_id").on(t.itemId), index("activity_log_created_at").on(t.createdAt)],
);

// ---------- Operational ----------

export interface SyncCounts {
  items: number;
  comments: number;
}

export interface SyncRepoError {
  repo: string;
  message: string;
}

export const syncRuns = pgTable("sync_runs", {
  id: serial("id").primaryKey(),
  trigger: text("trigger").$type<SyncTrigger>().notNull(),
  status: text("status").$type<SyncStatus>().notNull(),
  repoIds: jsonb("repo_ids").$type<number[]>().notNull(),
  doneRepoIds: jsonb("done_repo_ids").$type<number[]>().notNull().default([]),
  counts: jsonb("counts").$type<SyncCounts>().notNull().default({ items: 0, comments: 0 }),
  errors: jsonb("errors").$type<SyncRepoError[]>().notNull().default([]),
  error: text("error"),
  rateLimitResetAt: ts("rate_limit_reset_at"),
  heartbeatAt: ts("heartbeat_at").notNull().defaultNow(),
  startedAt: ts("started_at").notNull().defaultNow(),
  finishedAt: ts("finished_at"),
});

export const appState = pgTable("app_state", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const loginAttempts = pgTable("login_attempts", {
  ip: text("ip").primaryKey(),
  count: integer("count").notNull(),
  windowStart: ts("window_start").notNull(),
});
```

- [ ] **Step 5: Create `lib/db/client.ts` and `lib/db/upsert.ts`**

`lib/db/client.ts`:
```ts
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function create() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return drizzle({ client: neon(url), schema });
}

let cached: ReturnType<typeof create> | undefined;

/** Lazily created so importing modules never needs a DB at build time. */
export function db() {
  cached ??= create();
  return cached;
}

export type Db = ReturnType<typeof create>;
```

`lib/db/upsert.ts`:
```ts
import { getTableColumns, sql, type SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";

/** `set` clause for multi-row upserts: every column except `skip` takes the incoming (excluded) value. */
export function excludedSet<T extends PgTable>(table: T, skip: string[] = []): Record<string, SQL> {
  const columns = getTableColumns(table);
  return Object.fromEntries(
    Object.entries(columns)
      .filter(([key]) => !skip.includes(key))
      .map(([key, column]) => [key, sql.raw(`excluded."${column.name}"`)]),
  );
}
```

- [ ] **Step 6: drizzle config, migrate script, package scripts**

`drizzle.config.ts`:
```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "",
  },
});
```

`scripts/migrate.ts`:
```ts
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  console.warn("[migrate] No DATABASE_URL(_UNPOOLED) set — skipping migrations.");
  process.exit(0);
}
await migrate(drizzle({ client: neon(url) }), { migrationsFolder: "./drizzle" });
console.log("[migrate] Migrations applied.");
```

In `package.json` `scripts`, set:
```json
"dev": "next dev",
"build": "bun scripts/migrate.ts && next build",
"start": "next start",
"test": "bun test",
"db:generate": "drizzle-kit generate",
"db:migrate": "bun scripts/migrate.ts"
```

- [ ] **Step 7: Env example + gitignore**

`.env.example`:
```bash
# Injected by the Neon integration on Vercel; set manually for local dev.
DATABASE_URL=
DATABASE_URL_UNPOOLED=
# Fine-grained PAT, read-only: Issues, Pull requests, Metadata.
GITHUB_TOKEN=
# Dashboard login password.
ADMIN_PASSWORD=
# Bearer token Claude Code uses for the MCP endpoint (openssl rand -hex 32).
GIBIT_SECRET=
```

In `.gitignore`, directly under `.env*` add:
```
!.env.example
```

- [ ] **Step 8: Generate and apply the migration**

Run: `bun run db:generate`
Expected: creates `drizzle/0000_*.sql` and `drizzle/meta/`. Inspect the SQL: 12 `CREATE TABLE` statements, FKs with `ON DELETE cascade`.

Run: `bun run db:migrate`
Expected: `[migrate] Migrations applied.` (against the dev Neon DB from Prerequisites).

- [ ] **Step 9: Verify**

Run: `bun test && bunx tsc --noEmit && bun run build`
Expected: all PASS; build runs migrate (no-op, already applied) then `next build`.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add v2 database schema and migrations"
```

---

### Task 3: Session crypto

**Files:**
- Create: `lib/auth/session.ts`, `lib/auth/session.test.ts`

**Interfaces:**
- Produces:
  - `SESSION_COOKIE = "gibit_session"`, `SESSION_MAX_AGE_S = 2_592_000`
  - `signSession(password: string, expiresAt: number): Promise<string>`
  - `verifySession(password: string, token: string, now?: number): Promise<{ valid: true; expiresAt: number } | { valid: false }>`
  - `shouldRenew(expiresAt: number, now?: number): boolean`
  - `safeEqual(a: string, b: string): Promise<boolean>`
  - `safeNextPath(next: string | null | undefined): string`

- [ ] **Step 1: Write the failing tests**

`lib/auth/session.test.ts`:
```ts
import { describe, expect, test } from "bun:test";
import { safeEqual, safeNextPath, shouldRenew, signSession, verifySession } from "./session";

const NOW = 1_800_000_000_000;
const DAY = 86_400_000;

describe("sessions", () => {
  test("a signed session verifies with the same password", async () => {
    const token = await signSession("pw", NOW + DAY);
    expect(await verifySession("pw", token, NOW)).toEqual({ valid: true, expiresAt: NOW + DAY });
  });

  test("changing the password invalidates sessions", async () => {
    const token = await signSession("pw", NOW + DAY);
    expect((await verifySession("other", token, NOW)).valid).toBe(false);
  });

  test("tampered expiry is rejected", async () => {
    const token = await signSession("pw", NOW + DAY);
    const [, sig] = token.split(".");
    expect((await verifySession("pw", `${NOW + 99 * DAY}.${sig}`, NOW)).valid).toBe(false);
  });

  test("expired and malformed tokens are rejected", async () => {
    expect((await verifySession("pw", await signSession("pw", NOW - 1), NOW)).valid).toBe(false);
    expect((await verifySession("pw", "garbage", NOW)).valid).toBe(false);
    expect((await verifySession("pw", "123.!!!", NOW)).valid).toBe(false);
  });

  test("renews when under 15 days remain", () => {
    expect(shouldRenew(NOW + 20 * DAY, NOW)).toBe(false);
    expect(shouldRenew(NOW + 10 * DAY, NOW)).toBe(true);
  });
});

test("safeEqual compares contents", async () => {
  expect(await safeEqual("abc", "abc")).toBe(true);
  expect(await safeEqual("abc", "abd")).toBe(false);
  expect(await safeEqual("abc", "abcd")).toBe(false);
});

test("safeNextPath only allows local paths", () => {
  expect(safeNextPath("/settings")).toBe("/settings");
  expect(safeNextPath("/board?item=1")).toBe("/board?item=1");
  expect(safeNextPath("//evil.com")).toBe("/");
  expect(safeNextPath("https://evil.com")).toBe("/");
  expect(safeNextPath("/\\evil.com")).toBe("/");
  expect(safeNextPath(null)).toBe("/");
});
```

Run: `bun test lib/auth/session.test.ts` — Expected: FAIL (module missing).

- [ ] **Step 2: Implement `lib/auth/session.ts`**

```ts
// Web Crypto only, so this works in proxy.ts and in server code alike.

export const SESSION_COOKIE = "gibit_session";
export const SESSION_MAX_AGE_S = 30 * 24 * 60 * 60;
const RENEW_BELOW_MS = 15 * 24 * 60 * 60 * 1000;

const encoder = new TextEncoder();

async function sessionKey(password: string): Promise<CryptoKey> {
  const material = await crypto.subtle.digest("SHA-256", encoder.encode(`gibit-session:${password}`));
  return crypto.subtle.importKey("raw", material, { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

function toBase64Url(bytes: ArrayBuffer): string {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  try {
    return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

export async function signSession(password: string, expiresAt: number): Promise<string> {
  const signature = await crypto.subtle.sign("HMAC", await sessionKey(password), encoder.encode(String(expiresAt)));
  return `${expiresAt}.${toBase64Url(signature)}`;
}

export async function verifySession(
  password: string,
  token: string,
  now: number = Date.now(),
): Promise<{ valid: true; expiresAt: number } | { valid: false }> {
  const [expiresRaw, signatureRaw, extra] = token.split(".");
  if (!expiresRaw || !signatureRaw || extra !== undefined || !/^\d+$/.test(expiresRaw)) return { valid: false };
  const expiresAt = Number(expiresRaw);
  if (expiresAt <= now) return { valid: false };
  const signature = fromBase64Url(signatureRaw);
  if (!signature) return { valid: false };
  const ok = await crypto.subtle.verify("HMAC", await sessionKey(password), signature, encoder.encode(expiresRaw));
  return ok ? { valid: true, expiresAt } : { valid: false };
}

export function shouldRenew(expiresAt: number, now: number = Date.now()): boolean {
  return expiresAt - now < RENEW_BELOW_MS;
}

/** Constant-time string comparison (compares fixed-length digests). */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const [da, db] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);
  const x = new Uint8Array(da);
  const y = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/** Only same-origin absolute paths; anything else falls back to "/". */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}
```

- [ ] **Step 3: Run tests**

Run: `bun test lib/auth/session.test.ts` — Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/auth/session.ts lib/auth/session.test.ts
git commit -m "feat: add signed session tokens"
```

---

### Task 4: Login, logout, proxy, authenticated shell

**Files:**
- Create: `lib/auth/rate-limit.ts`, `lib/auth/rate-limit.test.ts`, `lib/auth/attempts.ts`, `lib/auth/server.ts`, `proxy.ts`, `app/login/page.tsx`, `app/login/login-form.tsx`, `app/login/actions.ts`, `app/(app)/layout.tsx`, `app/(app)/actions.ts`, `components/app-nav.tsx`

**Interfaces:**
- Consumes: `signSession`, `verifySession`, `shouldRenew`, `safeEqual`, `safeNextPath`, `SESSION_COOKIE`, `SESSION_MAX_AGE_S` (Task 3); `db()`, `loginAttempts` (Task 2).
- Produces:
  - `isBlocked(record: AttemptRecord | null, now: number): { blocked: boolean; retryAfterMs: number }`, `recordFailure(record: AttemptRecord | null, now: number): AttemptRecord`, `type AttemptRecord = { count: number; windowStart: number }`
  - `requireSession(): Promise<void>` (redirects to `/login` when invalid) — every later server action calls this first.
  - Authenticated route group `app/(app)/` with shared layout; later pages go in it.
  - `AppNav` links: Settings (Plan 3 adds Board and Reports).

- [ ] **Step 1: Write failing rate-limit tests**

`lib/auth/rate-limit.test.ts`:
```ts
import { expect, test } from "bun:test";
import { isBlocked, LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS, recordFailure } from "./rate-limit";

const NOW = 1_800_000_000_000;

test("no record is not blocked", () => {
  expect(isBlocked(null, NOW)).toEqual({ blocked: false, retryAfterMs: 0 });
});

test("blocks after max failures within the window", () => {
  let rec = null;
  for (let i = 0; i < LOGIN_MAX_ATTEMPTS; i++) rec = recordFailure(rec, NOW);
  expect(rec).toEqual({ count: LOGIN_MAX_ATTEMPTS, windowStart: NOW });
  expect(isBlocked(rec, NOW + 1000)).toEqual({ blocked: true, retryAfterMs: LOGIN_WINDOW_MS - 1000 });
});

test("window expiry resets the count", () => {
  const rec = { count: LOGIN_MAX_ATTEMPTS, windowStart: NOW };
  expect(isBlocked(rec, NOW + LOGIN_WINDOW_MS).blocked).toBe(false);
  expect(recordFailure(rec, NOW + LOGIN_WINDOW_MS)).toEqual({ count: 1, windowStart: NOW + LOGIN_WINDOW_MS });
});
```

Run: `bun test lib/auth/rate-limit.test.ts` — Expected: FAIL.

- [ ] **Step 2: Implement `lib/auth/rate-limit.ts`**

```ts
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_MAX_ATTEMPTS = 5;

export interface AttemptRecord {
  count: number;
  windowStart: number;
}

function expired(record: AttemptRecord, now: number): boolean {
  return now - record.windowStart >= LOGIN_WINDOW_MS;
}

export function isBlocked(record: AttemptRecord | null, now: number): { blocked: boolean; retryAfterMs: number } {
  if (!record || expired(record, now) || record.count < LOGIN_MAX_ATTEMPTS) {
    return { blocked: false, retryAfterMs: 0 };
  }
  return { blocked: true, retryAfterMs: record.windowStart + LOGIN_WINDOW_MS - now };
}

export function recordFailure(record: AttemptRecord | null, now: number): AttemptRecord {
  if (!record || expired(record, now)) return { count: 1, windowStart: now };
  return { count: record.count + 1, windowStart: record.windowStart };
}
```

Run: `bun test lib/auth/rate-limit.test.ts` — Expected: PASS.

- [ ] **Step 3: Persistence + server helpers**

`lib/auth/attempts.ts`:
```ts
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { loginAttempts } from "@/lib/db/schema";
import type { AttemptRecord } from "./rate-limit";

export async function getAttempts(ip: string): Promise<AttemptRecord | null> {
  const [row] = await db().select().from(loginAttempts).where(eq(loginAttempts.ip, ip));
  return row ? { count: row.count, windowStart: row.windowStart.getTime() } : null;
}

export async function saveAttempts(ip: string, record: AttemptRecord): Promise<void> {
  const values = { ip, count: record.count, windowStart: new Date(record.windowStart) };
  await db()
    .insert(loginAttempts)
    .values(values)
    .onConflictDoUpdate({ target: loginAttempts.ip, set: { count: values.count, windowStart: values.windowStart } });
}

export async function clearAttempts(ip: string): Promise<void> {
  await db().delete(loginAttempts).where(eq(loginAttempts.ip, ip));
}
```

`lib/auth/server.ts`:
```ts
import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, SESSION_MAX_AGE_S, signSession, verifySession } from "./session";

export function adminPassword(): string | null {
  return process.env.ADMIN_PASSWORD || null;
}

export async function setSessionCookie(): Promise<void> {
  const password = adminPassword();
  if (!password) throw new Error("ADMIN_PASSWORD is not set");
  const token = await signSession(password, Date.now() + SESSION_MAX_AGE_S * 1000);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_S,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Defense in depth for server actions and pages; proxy.ts is the first gate. */
export async function requireSession(): Promise<void> {
  const password = adminPassword();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!password || !token || !(await verifySession(password, token)).valid) redirect("/login");
}
```

Run: `bun add server-only`

- [ ] **Step 4: `proxy.ts`**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE_S, shouldRenew, signSession, verifySession } from "@/lib/auth/session";

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const password = process.env.ADMIN_PASSWORD;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = password && token ? await verifySession(password, token) : { valid: false as const };

  if (!session.valid) {
    if (pathname === "/login") return NextResponse.next();
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  if (pathname === "/login") return NextResponse.redirect(new URL("/", request.url));

  const response = NextResponse.next();
  if (password && shouldRenew(session.expiresAt)) {
    response.cookies.set(SESSION_COOKIE, await signSession(password, Date.now() + SESSION_MAX_AGE_S * 1000), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_S,
    });
  }
  return response;
}

export const config = {
  // /api/mcp does its own bearer auth (Plan 2).
  matcher: ["/((?!api/mcp|_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 5: Login page, form, action**

`app/login/actions.ts`:
```ts
"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { clearAttempts, getAttempts, saveAttempts } from "@/lib/auth/attempts";
import { isBlocked, recordFailure } from "@/lib/auth/rate-limit";
import { adminPassword, setSessionCookie } from "@/lib/auth/server";
import { safeEqual, safeNextPath } from "@/lib/auth/session";

export interface LoginState {
  error: string | null;
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const expected = adminPassword();
  if (!expected) return { error: "ADMIN_PASSWORD is not configured on the server." };

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const record = await getAttempts(ip);
  const block = isBlocked(record, now);
  if (block.blocked) {
    return { error: `Too many attempts. Try again in ${Math.ceil(block.retryAfterMs / 60_000)} min.` };
  }

  const password = String(formData.get("password") ?? "");
  if (!(await safeEqual(password, expected))) {
    await saveAttempts(ip, recordFailure(record, now));
    return { error: "Wrong password." };
  }

  await clearAttempts(ip);
  await setSessionCookie();
  redirect(safeNextPath(String(formData.get("next") ?? "")));
}
```

`app/login/login-form.tsx`:
```tsx
"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, { error: null });
  return (
    <form action={action} className="mt-8 flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      <label htmlFor="password" className="text-body-sm font-medium text-ink">
        Admin password
      </label>
      <input
        id="password"
        name="password"
        type="password"
        required
        autoFocus
        autoComplete="current-password"
        className="rounded-md border border-hairline bg-canvas px-3 py-2.5 text-body-md text-ink outline-none focus:border-primary"
      />
      {state.error && <p className="text-body-sm text-semantic-error">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-md bg-primary px-[18px] py-2.5 text-body-sm font-medium text-on-primary transition-colors duration-150 hover:bg-primary-pressed disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
```

`app/login/page.tsx`:
```tsx
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-6">
      <div className="w-full max-w-sm rounded-xl border border-hairline bg-canvas p-8">
        <h1 className="text-heading-4 text-ink">gibit</h1>
        <p className="mt-1 text-body-sm text-slate">Sign in to your triage board.</p>
        <LoginForm next={next ?? "/"} />
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Authenticated shell + logout**

`app/(app)/actions.ts`:
```ts
"use server";

import { redirect } from "next/navigation";
import { clearSessionCookie } from "@/lib/auth/server";

export async function logout(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}
```

`components/app-nav.tsx`:
```tsx
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
```

`app/(app)/layout.tsx`:
```tsx
import { AppNav } from "@/components/app-nav";
import { requireSession } from "@/lib/auth/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <AppNav />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 7: Verify**

Run: `bun test && bunx tsc --noEmit && bun run build`
Expected: PASS; build lists `/login` and `Proxy (Middleware)`.

Manual: `bun run dev`, open `http://localhost:3000/settings` → redirected to `/login?next=%2Fsettings`. Wrong password shows "Wrong password."; 6th wrong attempt shows "Too many attempts…". Correct password (`dev-password`) redirects to `/settings` (404 until Task 6 — expected). Visiting `/login` while signed in redirects to `/`. Delete the `login_attempts` row afterwards if you locked yourself out.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add admin login, session proxy, and app shell"
```

---

### Task 5: GitHub GraphQL client and name validation

**Files:**
- Create: `lib/github/names.ts`, `lib/github/names.test.ts`, `lib/github/graphql.ts`, `lib/github/graphql.test.ts`

**Interfaces:**
- Produces:
  - `isValidLogin(login: string): boolean`, `isValidRepoName(name: string): boolean`, `parseRepoFullName(input: string): { owner: string; name: string } | null`
  - `class GitHubError extends Error { kind: "not-found" | "rate-limited" | "api"; resetAt?: number }`
  - `graphql<T>(query: string, variables?: Record<string, unknown>, fetchImpl?: typeof fetch): Promise<T>`
  - `interface RateLimit { remaining: number; resetAt: string }`

- [ ] **Step 1: Write failing tests**

`lib/github/names.test.ts`:
```ts
import { expect, test } from "bun:test";
import { isValidLogin, isValidRepoName, parseRepoFullName } from "./names";

test("isValidLogin follows GitHub's login grammar", () => {
  expect(isValidLogin("asyncapi")).toBe(true);
  expect(isValidLogin("a-b")).toBe(true);
  expect(isValidLogin("-ab")).toBe(false);
  expect(isValidLogin("a".repeat(40))).toBe(false);
});

test("isValidRepoName allows dots, dashes, underscores", () => {
  expect(isValidRepoName("spec-json-schemas")).toBe(true);
  expect(isValidRepoName("asyncapi.github.io")).toBe(true);
  expect(isValidRepoName("bad/name")).toBe(false);
  expect(isValidRepoName("..")).toBe(false);
});

test("parseRepoFullName accepts owner/name and GitHub URLs", () => {
  expect(parseRepoFullName("asyncapi/cli")).toEqual({ owner: "asyncapi", name: "cli" });
  expect(parseRepoFullName(" https://github.com/asyncapi/cli/ ")).toEqual({ owner: "asyncapi", name: "cli" });
  expect(parseRepoFullName("github.com/asyncapi/cli.git")).toEqual({ owner: "asyncapi", name: "cli" });
  expect(parseRepoFullName("asyncapi")).toBeNull();
  expect(parseRepoFullName("a/b/c")).toBeNull();
});
```

`lib/github/graphql.test.ts`:
```ts
import { expect, test } from "bun:test";
import { GitHubError, graphql } from "./graphql";

process.env.GITHUB_TOKEN = "test-token";

function fakeFetch(status: number, body: unknown, headers: Record<string, string> = {}): typeof fetch {
  return (async () => new Response(JSON.stringify(body), { status, headers })) as unknown as typeof fetch;
}

test("returns data on success", async () => {
  const data = await graphql<{ viewer: { login: string } }>("query { viewer { login } }", {}, fakeFetch(200, { data: { viewer: { login: "me" } } }));
  expect(data.viewer.login).toBe("me");
});

test("maps NOT_FOUND errors", async () => {
  const run = graphql("q", {}, fakeFetch(200, { data: { repository: null }, errors: [{ type: "NOT_FOUND", message: "Could not resolve" }] }));
  await expect(run).rejects.toMatchObject({ kind: "not-found" });
});

test("maps RATE_LIMITED errors", async () => {
  const run = graphql("q", {}, fakeFetch(200, { errors: [{ type: "RATE_LIMITED", message: "limit" }] }));
  await expect(run).rejects.toMatchObject({ kind: "rate-limited" });
});

test("maps 403 with exhausted rate limit and reset", async () => {
  const run = graphql("q", {}, fakeFetch(403, {}, { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1800000000" }));
  await expect(run).rejects.toMatchObject({ kind: "rate-limited", resetAt: 1_800_000_000_000 });
});

test("maps 401 to an api error mentioning the token", async () => {
  const run = graphql("q", {}, fakeFetch(401, {}));
  await expect(run).rejects.toThrow(/GITHUB_TOKEN/);
});

test("maps other GraphQL errors to api", async () => {
  const run = graphql("q", {}, fakeFetch(200, { errors: [{ message: "boom" }] }));
  await expect(run).rejects.toBeInstanceOf(GitHubError);
  await expect(run).rejects.toMatchObject({ kind: "api" });
});
```

Run: `bun test lib/github` — Expected: FAIL (modules missing).

- [ ] **Step 2: Implement `lib/github/names.ts`**

```ts
/** GitHub login grammar: alphanumerics and hyphens, no leading/trailing hyphen, ≤ 39 chars. */
export function isValidLogin(login: string): boolean {
  return /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(login);
}

export function isValidRepoName(name: string): boolean {
  return /^[A-Za-z0-9._-]{1,100}$/.test(name) && name !== "." && name !== "..";
}

/** Accepts "owner/name", "github.com/owner/name", or a full URL (optional trailing "/" or ".git"). */
export function parseRepoFullName(input: string): { owner: string; name: string } | null {
  const cleaned = input
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/^github\.com\//, "")
    .replace(/\/+$/, "")
    .replace(/\.git$/, "");
  const parts = cleaned.split("/");
  if (parts.length !== 2) return null;
  const [owner, name] = parts as [string, string];
  return isValidLogin(owner) && isValidRepoName(name) ? { owner, name } : null;
}
```

- [ ] **Step 3: Implement `lib/github/graphql.ts`**

```ts
const ENDPOINT = "https://api.github.com/graphql";

export type GitHubErrorKind = "not-found" | "rate-limited" | "api";

export class GitHubError extends Error {
  constructor(
    public kind: GitHubErrorKind,
    message: string,
    /** ms epoch, only for rate-limited. */
    public resetAt?: number,
  ) {
    super(message);
    this.name = "GitHubError";
  }
}

export interface RateLimit {
  remaining: number;
  resetAt: string;
}

interface GraphQLResponse<T> {
  data?: T | null;
  errors?: { type?: string; message: string }[];
}

export async function graphql<T>(
  query: string,
  variables: Record<string, unknown> = {},
  fetchImpl: typeof fetch = fetch,
): Promise<T> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new GitHubError("api", "GITHUB_TOKEN is not set");

  const res = await fetchImpl(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "gibit",
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  if (res.status === 401) throw new GitHubError("api", "GitHub rejected GITHUB_TOKEN (401). Check the token.");
  if ((res.status === 403 || res.status === 429) && res.headers.get("x-ratelimit-remaining") === "0") {
    const resetSeconds = Number(res.headers.get("x-ratelimit-reset"));
    throw new GitHubError(
      "rate-limited",
      "GitHub API rate limit reached",
      Number.isFinite(resetSeconds) && resetSeconds > 0 ? resetSeconds * 1000 : undefined,
    );
  }
  if (!res.ok) throw new GitHubError("api", `GitHub GraphQL responded ${res.status}`);

  const body = (await res.json()) as GraphQLResponse<T>;
  if (body.errors?.length) {
    if (body.errors.some((e) => e.type === "NOT_FOUND")) {
      throw new GitHubError("not-found", body.errors.map((e) => e.message).join("; "));
    }
    if (body.errors.some((e) => e.type === "RATE_LIMITED")) {
      throw new GitHubError("rate-limited", "GitHub API rate limit reached");
    }
    throw new GitHubError("api", body.errors.map((e) => e.message).join("; "));
  }
  if (!body.data) throw new GitHubError("api", "GitHub GraphQL returned no data");
  return body.data;
}
```

- [ ] **Step 4: Run tests**

Run: `bun test lib/github` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/github
git commit -m "feat: add GitHub GraphQL client and name validation"
```

---

### Task 6: Repo configuration (service + Settings page)

**Files:**
- Create: `lib/github/queries.ts` (repo queries only in this task; Task 7 appends item queries), `lib/github/owner.ts`, `lib/repos.ts`, `app/(app)/settings/page.tsx`, `app/(app)/settings/actions.ts`, `app/(app)/settings/repo-forms.tsx`

**Interfaces:**
- Consumes: `graphql`, `GitHubError`, `parseRepoFullName`, `isValidLogin` (Task 5); `db()`, `repos`, `appState` (Task 2); `requireSession` (Task 4).
- Produces:
  - `getOwnerLogin(): Promise<string>` (cached in `app_state.owner_login`)
  - `type Repo = typeof repos.$inferSelect`
  - `listRepos(): Promise<Repo[]>`, `addRepo(input: string): Promise<Repo>`, `listOwnerRepos(owner: string): Promise<OwnerRepo[]>`, `addRepos(owner: string, names: string[]): Promise<number>`, `removeRepo(id: number): Promise<void>`, `setRepoEnabled(id: number, enabled: boolean): Promise<void>`
  - `interface OwnerRepo { name: string; private: boolean; archived: boolean; added: boolean }`
  - `type ActionResult = { ok: string | null; error: string | null }` (in `app/(app)/settings/actions.ts`)

- [ ] **Step 1: Repo queries — create `lib/github/queries.ts`**

```ts
import type { RateLimit } from "./graphql";

export const VIEWER_QUERY = `query { viewer { login } }`;

export const REPO_QUERY = `
query Repo($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    name
    owner { login }
    isPrivate
    isArchived
    defaultBranchRef { name }
  }
}`;

export interface RepoQueryResult {
  repository: {
    name: string;
    owner: { login: string };
    isPrivate: boolean;
    isArchived: boolean;
    defaultBranchRef: { name: string } | null;
  } | null;
}

export const OWNER_REPOS_QUERY = `
query OwnerRepos($login: String!, $after: String) {
  rateLimit { remaining resetAt }
  repositoryOwner(login: $login) {
    repositories(first: 100, after: $after, orderBy: { field: PUSHED_AT, direction: DESC }) {
      pageInfo { hasNextPage endCursor }
      nodes { name isPrivate isArchived defaultBranchRef { name } }
    }
  }
}`;

export interface OwnerReposResult {
  rateLimit: RateLimit;
  repositoryOwner: {
    repositories: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      nodes: { name: string; isPrivate: boolean; isArchived: boolean; defaultBranchRef: { name: string } | null }[];
    };
  } | null;
}
```

- [ ] **Step 2: Owner login — `lib/github/owner.ts`**

```ts
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { appState } from "@/lib/db/schema";
import { graphql } from "./graphql";
import { VIEWER_QUERY } from "./queries";

/** The login behind GITHUB_TOKEN — "me" everywhere in gibit. Cached in app_state. */
export async function getOwnerLogin(): Promise<string> {
  const [row] = await db().select().from(appState).where(eq(appState.key, "owner_login"));
  if (row) return row.value;
  const { viewer } = await graphql<{ viewer: { login: string } }>(VIEWER_QUERY);
  await db()
    .insert(appState)
    .values({ key: "owner_login", value: viewer.login })
    .onConflictDoUpdate({ target: appState.key, set: { value: viewer.login } });
  return viewer.login;
}
```

- [ ] **Step 3: Service — `lib/repos.ts`**

```ts
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { repos } from "@/lib/db/schema";
import { GitHubError, graphql } from "@/lib/github/graphql";
import { isValidLogin, parseRepoFullName } from "@/lib/github/names";
import { OWNER_REPOS_QUERY, REPO_QUERY, type OwnerReposResult, type RepoQueryResult } from "@/lib/github/queries";

export type Repo = typeof repos.$inferSelect;

export interface OwnerRepo {
  name: string;
  private: boolean;
  archived: boolean;
  added: boolean;
}

const MAX_OWNER_PAGES = 3; // up to 300 repos

export async function listRepos(): Promise<Repo[]> {
  return db().select().from(repos).orderBy(asc(repos.owner), asc(repos.name));
}

export async function addRepo(input: string): Promise<Repo> {
  const parsed = parseRepoFullName(input);
  if (!parsed) throw new Error(`"${input}" is not a valid owner/name`);
  const { repository } = await graphql<RepoQueryResult>(REPO_QUERY, parsed);
  if (!repository) throw new GitHubError("not-found", `${parsed.owner}/${parsed.name} not found or not accessible`);

  const values = {
    owner: repository.owner.login,
    name: repository.name,
    private: repository.isPrivate,
    defaultBranch: repository.defaultBranchRef?.name ?? "main",
  };
  await db().insert(repos).values(values).onConflictDoNothing();
  const [row] = await db()
    .select()
    .from(repos)
    .where(and(eq(repos.owner, values.owner), eq(repos.name, values.name)));
  if (!row) throw new Error("Failed to save repo");
  return row;
}

export async function listOwnerRepos(owner: string): Promise<OwnerRepo[]> {
  if (!isValidLogin(owner)) throw new Error(`"${owner}" is not a valid GitHub login`);
  const existing = new Set(
    (await db().select({ name: repos.name }).from(repos).where(eq(repos.owner, owner))).map((r) => r.name),
  );
  const result: OwnerRepo[] = [];
  let after: string | null = null;
  for (let page = 0; page < MAX_OWNER_PAGES; page++) {
    const data: OwnerReposResult = await graphql<OwnerReposResult>(OWNER_REPOS_QUERY, { login: owner, after });
    if (!data.repositoryOwner) throw new GitHubError("not-found", `${owner} not found`);
    const { nodes, pageInfo } = data.repositoryOwner.repositories;
    for (const node of nodes) {
      result.push({ name: node.name, private: node.isPrivate, archived: node.isArchived, added: existing.has(node.name) });
    }
    if (!pageInfo.hasNextPage) break;
    after = pageInfo.endCursor;
  }
  return result;
}

export async function addRepos(owner: string, names: string[]): Promise<number> {
  if (names.length === 0) return 0;
  const wanted = new Set(names);
  const candidates = (await listOwnerRepos(owner)).filter((r) => wanted.has(r.name) && !r.added);
  if (candidates.length === 0) return 0;
  // Default branch isn't in the owner listing's OwnerRepo shape; fetch per repo is wasteful,
  // so store "main" and let addRepo-style refresh happen on first sync (Task 9 updates it).
  await db()
    .insert(repos)
    .values(candidates.map((r) => ({ owner, name: r.name, private: r.private })))
    .onConflictDoNothing();
  return candidates.length;
}

export async function removeRepo(id: number): Promise<void> {
  await db().delete(repos).where(eq(repos.id, id));
}

export async function setRepoEnabled(id: number, enabled: boolean): Promise<void> {
  await db().update(repos).set({ enabled }).where(eq(repos.id, id));
}
```

> Note for Task 9: `fetchPage` reads `repository.defaultBranchRef` on each sync and updates `repos.default_branch`, so bulk-added repos get the right branch after their first sync.

- [ ] **Step 4: Server actions — `app/(app)/settings/actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/server";
import { addRepo, addRepos, listOwnerRepos, removeRepo, setRepoEnabled, type OwnerRepo } from "@/lib/repos";

export interface ActionResult {
  ok: string | null;
  error: string | null;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

export async function addRepoAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireSession();
  try {
    const repo = await addRepo(String(formData.get("repo") ?? ""));
    revalidatePath("/settings");
    return { ok: `Added ${repo.owner}/${repo.name}`, error: null };
  } catch (error) {
    return { ok: null, error: message(error) };
  }
}

export async function listOwnerReposAction(owner: string): Promise<{ repos: OwnerRepo[]; error: string | null }> {
  await requireSession();
  try {
    return { repos: await listOwnerRepos(owner.trim()), error: null };
  } catch (error) {
    return { repos: [], error: message(error) };
  }
}

export async function addReposAction(owner: string, names: string[]): Promise<ActionResult> {
  await requireSession();
  try {
    const count = await addRepos(owner, names);
    revalidatePath("/settings");
    return { ok: `Added ${count} repo${count === 1 ? "" : "s"}`, error: null };
  } catch (error) {
    return { ok: null, error: message(error) };
  }
}

export async function removeRepoAction(id: number): Promise<void> {
  await requireSession();
  await removeRepo(id);
  revalidatePath("/settings");
}

export async function toggleRepoAction(id: number, enabled: boolean): Promise<void> {
  await requireSession();
  await setRepoEnabled(id, enabled);
  revalidatePath("/settings");
}
```

- [ ] **Step 5: Client forms — `app/(app)/settings/repo-forms.tsx`**

```tsx
"use client";

import { useActionState, useState, useTransition } from "react";
import type { OwnerRepo } from "@/lib/repos";
import { addRepoAction, addReposAction, listOwnerReposAction, type ActionResult } from "./actions";

const inputClass =
  "min-w-0 flex-1 rounded-md border border-hairline bg-canvas px-3 py-2 text-body-sm text-ink outline-none focus:border-primary";
const buttonClass =
  "rounded-md bg-primary px-4 py-2 text-body-sm font-medium text-on-primary transition-colors duration-150 hover:bg-primary-pressed disabled:opacity-60";

function Feedback({ result }: { result: ActionResult }) {
  if (result.error) return <p className="mt-2 text-body-sm text-semantic-error">{result.error}</p>;
  if (result.ok) return <p className="mt-2 text-body-sm text-semantic-success">{result.ok}</p>;
  return null;
}

export function AddRepoForm() {
  const [state, action, pending] = useActionState(addRepoAction, { ok: null, error: null });
  return (
    <form action={action}>
      <div className="flex gap-2">
        <input name="repo" required placeholder="owner/name or GitHub URL" className={inputClass} />
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Adding…" : "Add repo"}
        </button>
      </div>
      <Feedback result={state} />
    </form>
  );
}

export function AddFromOwnerForm() {
  const [owner, setOwner] = useState("");
  const [loadedOwner, setLoadedOwner] = useState("");
  const [repos, setRepos] = useState<OwnerRepo[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<ActionResult>({ ok: null, error: null });
  const [pending, startTransition] = useTransition();

  function load() {
    startTransition(async () => {
      const res = await listOwnerReposAction(owner);
      setRepos(res.repos);
      setLoadedOwner(owner.trim());
      setSelected(new Set(res.repos.filter((r) => !r.added && !r.archived).map((r) => r.name)));
      setResult({ ok: null, error: res.error });
    });
  }

  function add() {
    startTransition(async () => {
      const res = await addReposAction(loadedOwner, [...selected]);
      setResult(res);
      if (!res.error) {
        setRepos((prev) => prev.map((r) => (selected.has(r.name) ? { ...r, added: true } : r)));
        setSelected(new Set());
      }
    });
  }

  function toggle(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          placeholder="org or user, e.g. asyncapi"
          className={inputClass}
        />
        <button type="button" onClick={load} disabled={pending || !owner.trim()} className={buttonClass}>
          {pending && repos.length === 0 ? "Loading…" : "List repos"}
        </button>
      </div>
      {repos.length > 0 && (
        <div className="mt-3 rounded-md border border-hairline">
          <ul className="max-h-72 divide-y divide-hairline overflow-y-auto">
            {repos.map((repo) => (
              <li key={repo.name} className="flex items-center gap-3 px-3 py-2">
                <input
                  type="checkbox"
                  id={`owner-repo-${repo.name}`}
                  checked={repo.added || selected.has(repo.name)}
                  disabled={repo.added}
                  onChange={() => toggle(repo.name)}
                />
                <label htmlFor={`owner-repo-${repo.name}`} className="flex-1 font-mono text-body-sm text-ink">
                  {repo.name}
                </label>
                {repo.added && <span className="text-micro text-stone">added</span>}
                {repo.archived && <span className="text-micro text-stone">archived</span>}
                {repo.private && <span className="text-micro text-stone">private</span>}
              </li>
            ))}
          </ul>
          <div className="flex justify-end border-t border-hairline px-3 py-2">
            <button type="button" onClick={add} disabled={pending || selected.size === 0} className={buttonClass}>
              Add {selected.size} selected
            </button>
          </div>
        </div>
      )}
      <Feedback result={result} />
    </div>
  );
}
```

- [ ] **Step 6: Settings page — `app/(app)/settings/page.tsx`**

```tsx
import { relativeTime } from "@/lib/time";
import { listRepos } from "@/lib/repos";
import { removeRepoAction, toggleRepoAction } from "./actions";
import { AddFromOwnerForm, AddRepoForm } from "./repo-forms";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const repos = await listRepos();
  return (
    <div className="flex flex-col gap-10">
      <h1 className="text-heading-3 text-ink">Settings</h1>

      <section className="flex flex-col gap-4">
        <h2 className="text-heading-5 text-ink">Repositories</h2>
        <AddRepoForm />
        <AddFromOwnerForm />
        {repos.length === 0 ? (
          <p className="text-body-sm text-slate">No repos yet. Add one above.</p>
        ) : (
          <ul className="divide-y divide-hairline rounded-md border border-hairline">
            {repos.map((repo) => (
              <li key={repo.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                <span className="font-mono text-body-sm text-ink">
                  {repo.owner}/{repo.name}
                </span>
                <span className="text-caption text-stone">
                  {repo.lastSyncedAt ? `synced ${relativeTime(repo.lastSyncedAt.toISOString())}` : "never synced"}
                </span>
                {!repo.enabled && <span className="text-caption text-stone">disabled</span>}
                {repo.lastError && <span className="w-full text-caption text-semantic-error">{repo.lastError}</span>}
                <div className="ml-auto flex gap-3">
                  <form action={toggleRepoAction.bind(null, repo.id, !repo.enabled)}>
                    <button type="submit" className="text-body-sm text-slate hover:text-ink">
                      {repo.enabled ? "Disable" : "Enable"}
                    </button>
                  </form>
                  <form action={removeRepoAction.bind(null, repo.id)}>
                    <button type="submit" className="text-body-sm text-semantic-error hover:underline">
                      Remove
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 7: Verify**

Run: `bun test && bunx tsc --noEmit && bun run build` — Expected: PASS.

Manual (`bun run dev`, signed in): add `asyncapi/cli` → appears in list. Add `nope/nope-nope` → red "not found" error. "List repos" for `asyncapi` → checklist; add two → they appear. Disable/Enable/Remove work.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add repo configuration settings page"
```

---

### Task 7: Item queries and GraphQL → row mapper

**Files:**
- Modify: `lib/github/queries.ts` (append)
- Create: `lib/github/map.ts`, `lib/github/map.test.ts`

**Interfaces:**
- Consumes: `isMaintainerRole`, `ItemState` (Task 2 model); `items`, `comments`, `mentions` table types (Task 2).
- Produces:
  - Query strings `ISSUES_QUERY`, `PRS_QUERY`; types `RawIssue`, `RawPullRequest`, `RawComment`, `PageInfo`, `IssuesPageResult`, `PrsPageResult`.
  - `type ItemRow = typeof items.$inferInsert`, `type CommentRow = typeof comments.$inferInsert`, `type MentionRow = typeof mentions.$inferInsert`
  - `interface MappedItem { item: ItemRow; comments: CommentRow[]; mentions: MentionRow[] }`
  - `mapIssue(raw: RawIssue, repoId: number, ownerLogin: string): MappedItem`
  - `mapPullRequest(raw: RawPullRequest, repoId: number, ownerLogin: string): MappedItem`
  - `extractMentions(text: string): string[]`

- [ ] **Step 1: Append item queries to `lib/github/queries.ts`**

```ts
const COMMENT_FIELDS = `id body createdAt authorAssociation author { login }`;

const ISSUE_FIELDS = `
  id number title body state url createdAt updatedAt closedAt authorAssociation
  author { login }
  labels(first: 20) { nodes { name color } }
  reactions { totalCount }
  comments(last: 50) { totalCount nodes { ${COMMENT_FIELDS} } }`;

const PR_FIELDS = `
  id number title body state url createdAt updatedAt closedAt mergedAt isDraft reviewDecision authorAssociation
  author { login }
  labels(first: 20) { nodes { name color } }
  reactions { totalCount }
  comments(last: 50) { totalCount nodes { ${COMMENT_FIELDS} } }
  reviews(last: 20) {
    nodes { id state body createdAt authorAssociation author { login } comments(first: 10) { nodes { ${COMMENT_FIELDS} } } }
  }
  reviewRequests(first: 10) { nodes { requestedReviewer { ... on User { login } ... on Team { slug } } } }`;

export const ISSUES_QUERY = `
query RepoIssues($owner: String!, $name: String!, $after: String, $since: DateTime, $states: [IssueState!]) {
  rateLimit { remaining resetAt }
  repository(owner: $owner, name: $name) {
    defaultBranchRef { name }
    issues(first: 25, after: $after, states: $states, filterBy: { since: $since }, orderBy: { field: UPDATED_AT, direction: ASC }) {
      pageInfo { hasNextPage endCursor }
      nodes { ${ISSUE_FIELDS} }
    }
  }
}`;

export const PRS_QUERY = `
query RepoPullRequests($owner: String!, $name: String!, $after: String, $states: [PullRequestState!]) {
  rateLimit { remaining resetAt }
  repository(owner: $owner, name: $name) {
    defaultBranchRef { name }
    pullRequests(first: 20, after: $after, states: $states, orderBy: { field: UPDATED_AT, direction: DESC }) {
      pageInfo { hasNextPage endCursor }
      nodes { ${PR_FIELDS} }
    }
  }
}`;

export interface PageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

export interface RawActor {
  login: string;
}

export interface RawComment {
  id: string;
  body: string;
  createdAt: string;
  authorAssociation: string;
  author: RawActor | null;
}

export interface RawIssue {
  id: string;
  number: number;
  title: string;
  body: string;
  state: "OPEN" | "CLOSED";
  url: string;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  authorAssociation: string;
  author: RawActor | null;
  labels: { nodes: { name: string; color: string }[] } | null;
  reactions: { totalCount: number };
  comments: { totalCount: number; nodes: RawComment[] };
}

export interface RawReview {
  id: string;
  state: string;
  body: string;
  createdAt: string;
  authorAssociation: string;
  author: RawActor | null;
  comments: { nodes: RawComment[] };
}

export interface RawPullRequest extends Omit<RawIssue, "state"> {
  state: "OPEN" | "CLOSED" | "MERGED";
  mergedAt: string | null;
  isDraft: boolean;
  reviewDecision: string | null;
  reviews: { nodes: RawReview[] };
  reviewRequests: { nodes: { requestedReviewer: { login?: string; slug?: string } | null }[] };
}

interface RepoPage<K extends string, N> {
  rateLimit: RateLimit;
  repository:
    | ({ defaultBranchRef: { name: string } | null } & Record<K, { pageInfo: PageInfo; nodes: N[] }>)
    | null;
}

export type IssuesPageResult = RepoPage<"issues", RawIssue>;
export type PrsPageResult = RepoPage<"pullRequests", RawPullRequest>;
```

- [ ] **Step 2: Write failing mapper tests — `lib/github/map.test.ts`**

```ts
import { describe, expect, test } from "bun:test";
import { extractMentions, mapIssue, mapPullRequest } from "./map";
import type { RawComment, RawIssue, RawPullRequest } from "./queries";

const OWNER = "souvikns";

function comment(id: string, login: string | null, role: string, createdAt: string, body = "ok"): RawComment {
  return { id, body, createdAt, authorAssociation: role, author: login ? { login } : null };
}

const issue: RawIssue = {
  id: "I_1",
  number: 12,
  title: "CLI crashes",
  body: "Steps... cc @souvikns and @derberg, not `@code` or foo@bar.com",
  state: "OPEN",
  url: "https://github.com/asyncapi/cli/issues/12",
  createdAt: "2026-11-01T00:00:00Z",
  updatedAt: "2026-11-03T00:00:00Z",
  closedAt: null,
  authorAssociation: "NONE",
  author: { login: "reporter" },
  labels: { nodes: [{ name: "bug", color: "d73a4a" }] },
  reactions: { totalCount: 3 },
  comments: {
    totalCount: 2,
    nodes: [
      comment("C_1", "derberg", "MEMBER", "2026-11-02T00:00:00Z", "Looking"),
      comment("C_2", "reporter", "NONE", "2026-11-03T00:00:00Z", "Any update @souvikns?"),
    ],
  },
};

describe("extractMentions", () => {
  test("finds @logins, skipping code, emails, teams, duplicates", () => {
    expect(
      extractMentions("hi @a-b and @A-B, `@code`, ```\n@block\n```, me@mail.com, @org/team, (@paren)"),
    ).toEqual(["a-b", "paren"]);
  });
});

describe("mapIssue", () => {
  const mapped = mapIssue(issue, 7, OWNER);

  test("maps item fields", () => {
    expect(mapped.item).toMatchObject({
      id: "I_1",
      repoId: 7,
      kind: "issue",
      number: 12,
      state: "open",
      author: "reporter",
      authorRole: "NONE",
      labels: [{ name: "bug", color: "d73a4a" }],
      commentsCount: 2,
      reactionsCount: 3,
      htmlUrl: "https://github.com/asyncapi/cli/issues/12",
      lastCommentBy: "reporter",
      lastCommentIsMaintainer: false,
      isDraft: false,
      requestedReviewers: [],
    });
    expect(mapped.item.updatedAt).toEqual(new Date("2026-11-03T00:00:00Z"));
    expect(mapped.item.lastCommentAt).toEqual(new Date("2026-11-03T00:00:00Z"));
  });

  test("maps comments", () => {
    expect(mapped.comments.map((c) => [c.id, c.kind, c.author])).toEqual([
      ["C_1", "comment", "derberg"],
      ["C_2", "comment", "reporter"],
    ]);
  });

  test("records maintainer mentions with answered state", () => {
    const summary = mapped.mentions.map((m) => [m.commentId, m.login, m.isOwner, m.answered]);
    expect(summary).toEqual([
      [null, "souvikns", true, true], // body mention; derberg (MEMBER) commented later
      [null, "derberg", false, true],
      ["C_2", "souvikns", true, false], // nobody from the team after C_2
    ]);
  });

  test("ghost authors become 'ghost'", () => {
    expect(mapIssue({ ...issue, author: null }, 7, OWNER).item.author).toBe("ghost");
  });
});

describe("mapPullRequest", () => {
  const pr: RawPullRequest = {
    ...issue,
    id: "PR_1",
    number: 40,
    body: "Fixes #12",
    state: "MERGED",
    mergedAt: "2026-11-05T00:00:00Z",
    closedAt: "2026-11-05T00:00:00Z",
    isDraft: false,
    reviewDecision: "APPROVED",
    comments: { totalCount: 0, nodes: [] },
    reviews: {
      nodes: [
        {
          id: "R_1",
          state: "APPROVED",
          body: "LGTM",
          createdAt: "2026-11-04T00:00:00Z",
          authorAssociation: "MEMBER",
          author: { login: "derberg" },
          comments: { nodes: [comment("RC_1", "derberg", "MEMBER", "2026-11-04T00:00:00Z", "nit")] },
        },
      ],
    },
    reviewRequests: { nodes: [{ requestedReviewer: { login: "souvikns" } }, { requestedReviewer: { slug: "core" } }] },
  };
  const mapped = mapPullRequest(pr, 7, OWNER);

  test("maps PR fields", () => {
    expect(mapped.item).toMatchObject({
      kind: "pr",
      state: "merged",
      reviewDecision: "APPROVED",
      requestedReviewers: ["souvikns", "team:core"],
      lastCommentBy: "derberg",
      lastCommentIsMaintainer: true,
    });
    expect(mapped.item.mergedAt).toEqual(new Date("2026-11-05T00:00:00Z"));
  });

  test("includes reviews and review comments", () => {
    expect(mapped.comments.map((c) => [c.id, c.kind, c.reviewState])).toEqual([
      ["R_1", "review", "APPROVED"],
      ["RC_1", "review_comment", null],
    ]);
  });
});
```

Run: `bun test lib/github/map.test.ts` — Expected: FAIL (module missing).

- [ ] **Step 3: Implement `lib/github/map.ts`**

```ts
import type { comments, items, mentions } from "@/lib/db/schema";
import { isMaintainerRole, type ItemState } from "@/lib/model";
import type { RawComment, RawIssue, RawPullRequest } from "./queries";

export type ItemRow = typeof items.$inferInsert;
export type CommentRow = typeof comments.$inferInsert;
export type MentionRow = typeof mentions.$inferInsert;

export interface MappedItem {
  item: ItemRow;
  comments: CommentRow[];
  mentions: MentionRow[];
}

const MENTION_RE = /(^|[^A-Za-z0-9_`./@])@([A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?)(?![A-Za-z0-9_/-])/g;

/** Unique @logins (lowercased), ignoring fenced/inline code, blockquotes, emails and @org/team. */
export function extractMentions(text: string): string[] {
  const stripped = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`\n]*`/g, " ")
    .replace(/^>.*$/gm, " ");
  const found: string[] = [];
  for (const match of stripped.matchAll(MENTION_RE)) {
    const login = (match[2] ?? "").toLowerCase();
    if (login && !found.includes(login)) found.push(login);
  }
  return found;
}

const login = (actor: { login: string } | null) => actor?.login ?? "ghost";
const date = (iso: string) => new Date(iso);
const optionalDate = (iso: string | null) => (iso ? new Date(iso) : null);

interface ThreadEntry {
  commentId: string | null;
  author: string;
  role: string;
  body: string;
  createdAt: Date;
}

function isTeam(author: string, role: string, ownerLower: string): boolean {
  return isMaintainerRole(role) || author.toLowerCase() === ownerLower;
}

function buildMentions(itemId: string, entries: ThreadEntry[], ownerLogin: string, extraMaintainers: string[]): MentionRow[] {
  const ownerLower = ownerLogin.toLowerCase();
  const maintainers = new Set<string>([ownerLower, ...extraMaintainers.map((l) => l.toLowerCase())]);
  for (const entry of entries) if (isMaintainerRole(entry.role)) maintainers.add(entry.author.toLowerCase());

  const sorted = [...entries].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const rows: MentionRow[] = [];
  for (const entry of sorted) {
    for (const mentioned of extractMentions(entry.body)) {
      if (!maintainers.has(mentioned) || mentioned === entry.author.toLowerCase()) continue;
      const answered = sorted.some(
        (later) => later.createdAt > entry.createdAt && isTeam(later.author, later.role, ownerLower),
      );
      rows.push({
        itemId,
        commentId: entry.commentId,
        login: mentioned,
        isOwner: mentioned === ownerLower,
        isMaintainer: true,
        answered,
        createdAt: entry.createdAt,
      });
    }
  }
  return rows;
}

function commentRow(itemId: string, raw: RawComment, kind: CommentRow["kind"], reviewState: string | null = null): CommentRow {
  return {
    id: raw.id,
    itemId,
    author: login(raw.author),
    authorRole: raw.authorAssociation,
    kind,
    reviewState,
    body: raw.body,
    createdAt: date(raw.createdAt),
  };
}

function lastComment(rows: CommentRow[], ownerLogin: string) {
  const latest = [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  if (!latest) return { lastCommentBy: null, lastCommentAt: null, lastCommentIsMaintainer: false };
  return {
    lastCommentBy: latest.author,
    lastCommentAt: latest.createdAt,
    lastCommentIsMaintainer: isTeam(latest.author, latest.authorRole, ownerLogin.toLowerCase()),
  };
}

function baseItem(raw: RawIssue | RawPullRequest, repoId: number, state: ItemState) {
  return {
    id: raw.id,
    repoId,
    number: raw.number,
    title: raw.title,
    body: raw.body,
    state,
    author: login(raw.author),
    authorRole: raw.authorAssociation,
    labels: (raw.labels?.nodes ?? []).map((l) => ({ name: l.name, color: l.color })),
    commentsCount: raw.comments.totalCount,
    reactionsCount: raw.reactions.totalCount,
    createdAt: date(raw.createdAt),
    updatedAt: date(raw.updatedAt),
    closedAt: optionalDate(raw.closedAt),
    htmlUrl: raw.url,
  };
}

function entriesFor(raw: RawIssue | RawPullRequest, rows: CommentRow[]): ThreadEntry[] {
  return [
    { commentId: null, author: login(raw.author), role: raw.authorAssociation, body: raw.body, createdAt: date(raw.createdAt) },
    ...rows.map((c) => ({ commentId: c.id, author: c.author, role: c.authorRole, body: c.body ?? "", createdAt: c.createdAt })),
  ];
}

export function mapIssue(raw: RawIssue, repoId: number, ownerLogin: string): MappedItem {
  const rows = raw.comments.nodes.map((c) => commentRow(raw.id, c, "comment"));
  return {
    item: {
      ...baseItem(raw, repoId, raw.state === "CLOSED" ? "closed" : "open"),
      kind: "issue",
      mergedAt: null,
      isDraft: false,
      reviewDecision: null,
      requestedReviewers: [],
      ...lastComment(rows, ownerLogin),
    },
    comments: rows,
    mentions: buildMentions(raw.id, entriesFor(raw, rows), ownerLogin, []),
  };
}

export function mapPullRequest(raw: RawPullRequest, repoId: number, ownerLogin: string): MappedItem {
  const state: ItemState = raw.state === "MERGED" ? "merged" : raw.state === "CLOSED" ? "closed" : "open";
  const rows: CommentRow[] = [
    ...raw.comments.nodes.map((c) => commentRow(raw.id, c, "comment")),
    ...raw.reviews.nodes.flatMap((review) => [
      commentRow(
        raw.id,
        { id: review.id, body: review.body, createdAt: review.createdAt, authorAssociation: review.authorAssociation, author: review.author },
        "review",
        review.state,
      ),
      ...review.comments.nodes.map((c) => commentRow(raw.id, c, "review_comment")),
    ]),
  ];
  const requestedReviewers = raw.reviewRequests.nodes.flatMap(({ requestedReviewer: r }) =>
    r?.login ? [r.login] : r?.slug ? [`team:${r.slug}`] : [],
  );
  return {
    item: {
      ...baseItem(raw, repoId, state),
      kind: "pr",
      mergedAt: optionalDate(raw.mergedAt),
      isDraft: raw.isDraft,
      reviewDecision: raw.reviewDecision,
      requestedReviewers,
      ...lastComment(rows, ownerLogin),
    },
    comments: rows,
    mentions: buildMentions(
      raw.id,
      entriesFor(raw, rows),
      ownerLogin,
      requestedReviewers.filter((r) => !r.startsWith("team:")),
    ),
  };
}
```

- [ ] **Step 4: Run tests**

Run: `bun test lib/github/map.test.ts` — Expected: PASS. If the `extractMentions` expectation fails on `(@paren)`, confirm `(` is not in the excluded-prefix class; it must match.

- [ ] **Step 5: Typecheck and commit**

Run: `bunx tsc --noEmit` — Expected: clean.

```bash
git add lib/github
git commit -m "feat: map GitHub issues and PRs to database rows"
```

---

### Task 8: Sync rules and repo phase planning (pure)

**Files:**
- Create: `lib/sync/rules.ts`, `lib/sync/rules.test.ts`, `lib/sync/plan.ts`, `lib/sync/plan.test.ts`

**Interfaces:**
- Consumes: `BoardColumn`, `ItemState`, `RepoSyncState`, `SyncPhase` (Task 2).
- Produces:
  - `mechanicalMove(current: BoardColumn | null, state: ItemState): BoardColumn | null` (null = no change)
  - `BACKFILL_DAYS = 90`
  - `initialRepoState(repo: { syncCursor: Date | null; backfilledAt: Date | null }, now: number): RepoSyncState`
  - `advanceRepoState(state: RepoSyncState, page: { hasNextPage: boolean; endCursor: string | null; reachedSince: boolean; maxUpdatedAt: string | null }): RepoSyncState | "done"`
  - `phaseKind(phase: SyncPhase): "issues" | "prs"`

- [ ] **Step 1: Write failing tests**

`lib/sync/rules.test.ts`:
```ts
import { expect, test } from "bun:test";
import { mechanicalMove } from "./rules";

test("new items land in inbox, or done if already closed", () => {
  expect(mechanicalMove(null, "open")).toBe("inbox");
  expect(mechanicalMove(null, "closed")).toBe("done");
  expect(mechanicalMove(null, "merged")).toBe("done");
});

test("closed or merged items move to done", () => {
  expect(mechanicalMove("waiting", "closed")).toBe("done");
  expect(mechanicalMove("ready", "merged")).toBe("done");
  expect(mechanicalMove("done", "closed")).toBeNull();
});

test("reopened items go back to inbox", () => {
  expect(mechanicalMove("done", "open")).toBe("inbox");
});

test("open items elsewhere are left alone", () => {
  expect(mechanicalMove("needs_reply", "open")).toBeNull();
  expect(mechanicalMove("inbox", "open")).toBeNull();
});
```

`lib/sync/plan.test.ts`:
```ts
import { describe, expect, test } from "bun:test";
import { advanceRepoState, BACKFILL_DAYS, initialRepoState } from "./plan";

const NOW = Date.parse("2026-11-26T00:00:00Z");
const BACKFILL_SINCE = new Date(NOW - BACKFILL_DAYS * 86_400_000).toISOString();

describe("initialRepoState", () => {
  test("unbackfilled repo starts backfill with a 90-day window", () => {
    expect(initialRepoState({ syncCursor: null, backfilledAt: null }, NOW)).toEqual({
      backfill: true,
      phase: "issues-open",
      after: null,
      since: BACKFILL_SINCE,
      maxUpdatedAt: null,
    });
  });

  test("backfilled repo syncs incrementally from its cursor", () => {
    const cursor = new Date("2026-11-20T00:00:00Z");
    expect(initialRepoState({ syncCursor: cursor, backfilledAt: cursor }, NOW)).toEqual({
      backfill: false,
      phase: "issues-since",
      after: null,
      since: cursor.toISOString(),
      maxUpdatedAt: cursor.toISOString(),
    });
  });
});

describe("advanceRepoState", () => {
  const base = initialRepoState({ syncCursor: null, backfilledAt: null }, NOW);

  test("next page stays in phase and keeps the max updatedAt", () => {
    const next = advanceRepoState(
      { ...base, maxUpdatedAt: "2026-11-25T00:00:00Z" },
      { hasNextPage: true, endCursor: "abc", reachedSince: false, maxUpdatedAt: "2026-11-24T00:00:00Z" },
    );
    expect(next).toEqual({ ...base, after: "abc", maxUpdatedAt: "2026-11-25T00:00:00Z" });
  });

  test("backfill walks issues-open → issues-since → prs-open → prs-recent → done", () => {
    const last = { hasNextPage: false, endCursor: null, reachedSince: false, maxUpdatedAt: null };
    const s1 = advanceRepoState(base, last);
    expect(s1).toMatchObject({ phase: "issues-since", after: null });
    const s2 = advanceRepoState(s1 as typeof base, last);
    expect(s2).toMatchObject({ phase: "prs-open" });
    const s3 = advanceRepoState(s2 as typeof base, last);
    expect(s3).toMatchObject({ phase: "prs-recent" });
    expect(advanceRepoState(s3 as typeof base, last)).toBe("done");
  });

  test("incremental walks issues-since → prs-recent → done", () => {
    const inc = initialRepoState({ syncCursor: new Date(NOW), backfilledAt: new Date(NOW) }, NOW);
    const last = { hasNextPage: false, endCursor: null, reachedSince: false, maxUpdatedAt: null };
    const s1 = advanceRepoState(inc, last);
    expect(s1).toMatchObject({ phase: "prs-recent" });
    expect(advanceRepoState(s1 as typeof inc, last)).toBe("done");
  });

  test("prs-recent stops early once it passes the since bound", () => {
    const state = { ...base, phase: "prs-recent" as const };
    expect(advanceRepoState(state, { hasNextPage: true, endCursor: "x", reachedSince: true, maxUpdatedAt: null })).toBe("done");
  });
});
```

Run: `bun test lib/sync` — Expected: FAIL.

- [ ] **Step 2: Implement `lib/sync/rules.ts`**

```ts
import type { BoardColumn, ItemState } from "@/lib/model";

/** The only column changes sync makes; every judgment move is Claude's or the owner's. */
export function mechanicalMove(current: BoardColumn | null, state: ItemState): BoardColumn | null {
  const closed = state !== "open";
  if (current === null) return closed ? "done" : "inbox";
  if (closed) return current === "done" ? null : "done";
  return current === "done" ? "inbox" : null;
}
```

- [ ] **Step 3: Implement `lib/sync/plan.ts`**

```ts
import type { RepoSyncState, SyncPhase } from "@/lib/model";

export const BACKFILL_DAYS = 90;
const DAY_MS = 86_400_000;

const BACKFILL_PHASES: SyncPhase[] = ["issues-open", "issues-since", "prs-open", "prs-recent"];
const INCREMENTAL_PHASES: SyncPhase[] = ["issues-since", "prs-recent"];

export function phaseKind(phase: SyncPhase): "issues" | "prs" {
  return phase.startsWith("issues") ? "issues" : "prs";
}

export function initialRepoState(
  repo: { syncCursor: Date | null; backfilledAt: Date | null },
  now: number,
): RepoSyncState {
  if (!repo.backfilledAt || !repo.syncCursor) {
    return {
      backfill: true,
      phase: "issues-open",
      after: null,
      since: new Date(now - BACKFILL_DAYS * DAY_MS).toISOString(),
      maxUpdatedAt: null,
    };
  }
  const cursor = repo.syncCursor.toISOString();
  return { backfill: false, phase: "issues-since", after: null, since: cursor, maxUpdatedAt: cursor };
}

function maxIso(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

export function advanceRepoState(
  state: RepoSyncState,
  page: { hasNextPage: boolean; endCursor: string | null; reachedSince: boolean; maxUpdatedAt: string | null },
): RepoSyncState | "done" {
  const maxUpdatedAt = maxIso(state.maxUpdatedAt, page.maxUpdatedAt);
  const phaseFinished = !page.hasNextPage || (state.phase === "prs-recent" && page.reachedSince);
  if (!phaseFinished) return { ...state, after: page.endCursor, maxUpdatedAt };

  const phases = state.backfill ? BACKFILL_PHASES : INCREMENTAL_PHASES;
  const next = phases[phases.indexOf(state.phase) + 1];
  if (!next) return "done";
  return { ...state, phase: next, after: null, maxUpdatedAt };
}
```

- [ ] **Step 4: Run tests and commit**

Run: `bun test lib/sync && bunx tsc --noEmit` — Expected: PASS, clean.

```bash
git add lib/sync
git commit -m "feat: add sync column rules and phase planning"
```

---

### Task 9: Sync engine, store, and Settings sync panel

**Files:**
- Create: `lib/sync/fetch-page.ts`, `lib/sync/store.ts`, `lib/sync/run.ts`, `scripts/sync.ts`, `app/(app)/settings/sync-panel.tsx`
- Modify: `app/(app)/settings/actions.ts` (add `syncStepAction`), `app/(app)/settings/page.tsx` (render panel, `maxDuration`)

**Interfaces:**
- Consumes: `graphql`, `GitHubError` (Task 5); `ISSUES_QUERY`, `PRS_QUERY`, page types, `mapIssue`, `mapPullRequest`, `MappedItem` (Task 7); `mechanicalMove`, `initialRepoState`, `advanceRepoState`, `phaseKind` (Task 8); `getOwnerLogin` (Task 6); `db()`, tables, `excludedSet` (Task 2); `requireSession` (Task 4).
- Produces:
  - `interface SyncProgress { runId: number; status: SyncStatus; reposDone: number; reposTotal: number; counts: SyncCounts; errors: SyncRepoError[]; rateLimitResetAt: string | null; message: string }`
  - `syncStep(opts: { trigger: SyncTrigger; repoIds?: number[]; budgetMs?: number }): Promise<SyncProgress>` — **Plan 2's MCP `sync` tool calls exactly this.**
  - `getLatestSync(): Promise<SyncProgress | null>`
  - `syncStepAction(): Promise<SyncProgress | { error: string }>`

- [ ] **Step 1: `lib/sync/fetch-page.ts`**

```ts
import { GitHubError, graphql, type RateLimit } from "@/lib/github/graphql";
import { mapIssue, mapPullRequest, type MappedItem } from "@/lib/github/map";
import { ISSUES_QUERY, PRS_QUERY, type IssuesPageResult, type PrsPageResult } from "@/lib/github/queries";
import type { RepoSyncState } from "@/lib/model";
import { phaseKind } from "./plan";

export interface FetchedPage {
  mapped: MappedItem[];
  hasNextPage: boolean;
  endCursor: string | null;
  reachedSince: boolean;
  maxUpdatedAt: string | null;
  defaultBranch: string | null;
  rateLimit: RateLimit;
}

export async function fetchPage(
  repo: { id: number; owner: string; name: string },
  state: RepoSyncState,
  ownerLogin: string,
): Promise<FetchedPage> {
  const base = { owner: repo.owner, name: repo.name, after: state.after };

  if (phaseKind(state.phase) === "issues") {
    const variables =
      state.phase === "issues-open"
        ? { ...base, states: ["OPEN"], since: null }
        : { ...base, states: null, since: state.since };
    const data = await graphql<IssuesPageResult>(ISSUES_QUERY, variables);
    if (!data.repository) throw new GitHubError("not-found", `${repo.owner}/${repo.name} not found`);
    const { nodes, pageInfo } = data.repository.issues;
    return {
      mapped: nodes.map((n) => mapIssue(n, repo.id, ownerLogin)),
      hasNextPage: pageInfo.hasNextPage,
      endCursor: pageInfo.endCursor,
      reachedSince: false,
      maxUpdatedAt: nodes.reduce<string | null>((max, n) => (!max || n.updatedAt > max ? n.updatedAt : max), null),
      defaultBranch: data.repository.defaultBranchRef?.name ?? null,
      rateLimit: data.rateLimit,
    };
  }

  const variables = { ...base, states: state.phase === "prs-open" ? ["OPEN"] : null };
  const data = await graphql<PrsPageResult>(PRS_QUERY, variables);
  if (!data.repository) throw new GitHubError("not-found", `${repo.owner}/${repo.name} not found`);
  const { nodes, pageInfo } = data.repository.pullRequests;
  // prs-recent is ordered newest-first: keep only nodes at/after `since`, and stop once we pass it.
  const inWindow =
    state.phase === "prs-recent" && state.since ? nodes.filter((n) => n.updatedAt >= state.since!) : nodes;
  return {
    mapped: inWindow.map((n) => mapPullRequest(n, repo.id, ownerLogin)),
    hasNextPage: pageInfo.hasNextPage,
    endCursor: pageInfo.endCursor,
    reachedSince: inWindow.length < nodes.length,
    maxUpdatedAt: inWindow.reduce<string | null>((max, n) => (!max || n.updatedAt > max ? n.updatedAt : max), null),
    defaultBranch: data.repository.defaultBranchRef?.name ?? null,
    rateLimit: data.rateLimit,
  };
}
```

- [ ] **Step 2: `lib/sync/store.ts`**

```ts
import { inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { activityLog, comments, items, mentions, triage } from "@/lib/db/schema";
import { excludedSet } from "@/lib/db/upsert";
import type { MappedItem } from "@/lib/github/map";
import { mechanicalMove } from "./rules";

/** Persist one fetched page. Idempotent: re-storing the same page changes nothing. */
export async function storePage(page: MappedItem[]): Promise<{ items: number; comments: number }> {
  if (page.length === 0) return { items: 0, comments: 0 };
  const ids = page.map((m) => m.item.id!);
  const commentRows = page.flatMap((m) => m.comments);
  const mentionRows = page.flatMap((m) => m.mentions);

  await db()
    .insert(items)
    .values(page.map((m) => m.item))
    .onConflictDoUpdate({ target: items.id, set: excludedSet(items, ["id"]) });

  if (commentRows.length > 0) {
    await db()
      .insert(comments)
      .values(commentRows)
      .onConflictDoUpdate({ target: comments.id, set: excludedSet(comments, ["id"]) });
  }

  await db().delete(mentions).where(inArray(mentions.itemId, ids));
  if (mentionRows.length > 0) await db().insert(mentions).values(mentionRows);

  const existing = new Map(
    (await db().select({ itemId: triage.itemId, column: triage.column }).from(triage).where(inArray(triage.itemId, ids))).map(
      (t) => [t.itemId, t.column],
    ),
  );
  const now = new Date();
  const moves = page.flatMap((m) => {
    const from = existing.get(m.item.id!) ?? null;
    const to = mechanicalMove(from, m.item.state);
    return to ? [{ itemId: m.item.id!, from, to }] : [];
  });
  if (moves.length > 0) {
    await db()
      .insert(triage)
      .values(moves.map((mv) => ({ itemId: mv.itemId, column: mv.to, lastReason: "sync", updatedAt: now })))
      .onConflictDoUpdate({ target: triage.itemId, set: excludedSet(triage, ["itemId", "priority", "seenAt"]) });
    await db()
      .insert(activityLog)
      .values(moves.map((mv) => ({ itemId: mv.itemId, actor: "sync" as const, action: "move" as const, detail: { from: mv.from, to: mv.to, reason: "sync" } })));
  }

  return { items: page.length, comments: commentRows.length };
}
```

- [ ] **Step 3: `lib/sync/run.ts`**

```ts
import { and, desc, eq, inArray, lt, or } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { repos, syncRuns, type SyncCounts, type SyncRepoError } from "@/lib/db/schema";
import { GitHubError } from "@/lib/github/graphql";
import { getOwnerLogin } from "@/lib/github/owner";
import type { SyncStatus, SyncTrigger } from "@/lib/model";
import { fetchPage } from "./fetch-page";
import { advanceRepoState, initialRepoState } from "./plan";
import { storePage } from "./store";

const DEFAULT_BUDGET_MS = 45_000;
/** A "running" step with an older heartbeat is considered dead and may be taken over. */
const STALE_MS = 2 * 60_000;
const MIN_RATE_REMAINING = 200;

export interface SyncProgress {
  runId: number;
  status: SyncStatus;
  reposDone: number;
  reposTotal: number;
  counts: SyncCounts;
  errors: SyncRepoError[];
  rateLimitResetAt: string | null;
  message: string;
}

type Run = typeof syncRuns.$inferSelect;

function progress(run: Run, message: string): SyncProgress {
  return {
    runId: run.id,
    status: run.status,
    reposDone: run.doneRepoIds.length,
    reposTotal: run.repoIds.length,
    counts: run.counts,
    errors: run.errors,
    rateLimitResetAt: run.rateLimitResetAt?.toISOString() ?? null,
    message,
  };
}

export async function getLatestSync(): Promise<SyncProgress | null> {
  const [run] = await db().select().from(syncRuns).orderBy(desc(syncRuns.id)).limit(1);
  return run ? progress(run, "") : null;
}

async function findActiveRun(): Promise<Run | undefined> {
  const [run] = await db()
    .select()
    .from(syncRuns)
    .where(inArray(syncRuns.status, ["running", "partial"]))
    .orderBy(desc(syncRuns.id))
    .limit(1);
  return run;
}

/** Atomically claim a partial or stale run for this step. Returns null if another step holds it. */
async function claim(runId: number, now: Date): Promise<Run | null> {
  const [run] = await db()
    .update(syncRuns)
    .set({ status: "running", heartbeatAt: now })
    .where(
      and(
        eq(syncRuns.id, runId),
        or(eq(syncRuns.status, "partial"), lt(syncRuns.heartbeatAt, new Date(now.getTime() - STALE_MS))),
      ),
    )
    .returning();
  return run ?? null;
}

export async function syncStep(opts: { trigger: SyncTrigger; repoIds?: number[]; budgetMs?: number }): Promise<SyncProgress> {
  const startedAt = Date.now();
  const budget = opts.budgetMs ?? DEFAULT_BUDGET_MS;
  const now = new Date(startedAt);

  let run: Run | null | undefined = await findActiveRun();
  if (run) {
    if (run.rateLimitResetAt && run.rateLimitResetAt.getTime() > startedAt) {
      return progress(run, `Rate limited until ${run.rateLimitResetAt.toISOString()}. Call again after that.`);
    }
    const claimed = await claim(run.id, now);
    if (!claimed) return progress(run, "A sync step is already running. Call again shortly.");
    run = claimed;
  } else {
    const enabled = await db().select({ id: repos.id }).from(repos).where(eq(repos.enabled, true));
    const ids = enabled.map((r) => r.id).filter((id) => !opts.repoIds || opts.repoIds.includes(id));
    if (ids.length === 0) {
      const [empty] = await db()
        .insert(syncRuns)
        .values({ trigger: opts.trigger, status: "done", repoIds: [], finishedAt: now })
        .returning();
      return progress(empty!, "No enabled repos to sync. Add repos in Settings.");
    }
    const [created] = await db().insert(syncRuns).values({ trigger: opts.trigger, status: "running", repoIds: ids }).returning();
    run = created!;
  }

  const ownerLogin = await getOwnerLogin();
  const counts: SyncCounts = { ...run.counts };
  const errors: SyncRepoError[] = [...run.errors];
  const done = new Set(run.doneRepoIds);
  let rateLimitResetAt: Date | null = null;

  const remainingIds = run.repoIds.filter((id) => !done.has(id));
  const pending = remainingIds.length > 0 ? await db().select().from(repos).where(inArray(repos.id, remainingIds)) : [];

  outer: for (const repo of pending) {
    let state = repo.syncState ?? initialRepoState(repo, Date.now());
    const label = `${repo.owner}/${repo.name}`;
    try {
      while (true) {
        if (Date.now() - startedAt > budget) {
          await db().update(repos).set({ syncState: state }).where(eq(repos.id, repo.id));
          break outer;
        }
        const page = await fetchPage(repo, state, ownerLogin);
        const stored = await storePage(page.mapped);
        counts.items += stored.items;
        counts.comments += stored.comments;

        const next = advanceRepoState(state, page);
        if (next === "done") {
          const cursorIso = page.maxUpdatedAt && (!state.maxUpdatedAt || page.maxUpdatedAt > state.maxUpdatedAt) ? page.maxUpdatedAt : state.maxUpdatedAt;
          await db()
            .update(repos)
            .set({
              syncCursor: cursorIso ? new Date(cursorIso) : repo.syncCursor,
              backfilledAt: repo.backfilledAt ?? new Date(),
              syncState: null,
              lastSyncedAt: new Date(),
              lastError: null,
              ...(page.defaultBranch ? { defaultBranch: page.defaultBranch } : {}),
            })
            .where(eq(repos.id, repo.id));
          done.add(repo.id);
          break;
        }
        state = next;
        await db().update(repos).set({ syncState: state }).where(eq(repos.id, repo.id));
        await db().update(syncRuns).set({ heartbeatAt: new Date(), counts }).where(eq(syncRuns.id, run.id));

        if (page.rateLimit.remaining < MIN_RATE_REMAINING) {
          rateLimitResetAt = new Date(page.rateLimit.resetAt);
          break outer;
        }
      }
    } catch (error) {
      if (error instanceof GitHubError && error.kind === "rate-limited") {
        await db().update(repos).set({ syncState: state }).where(eq(repos.id, repo.id));
        rateLimitResetAt = new Date(error.resetAt ?? Date.now() + 60 * 60_000);
        break;
      }
      const message = error instanceof Error ? error.message : String(error);
      errors.push({ repo: label, message });
      await db().update(repos).set({ lastError: message, syncState: null }).where(eq(repos.id, repo.id));
      done.add(repo.id);
    }
  }

  const finished = run.repoIds.every((id) => done.has(id));
  const [saved] = await db()
    .update(syncRuns)
    .set({
      status: finished ? "done" : "partial",
      doneRepoIds: [...done],
      counts,
      errors,
      rateLimitResetAt,
      heartbeatAt: new Date(),
      finishedAt: finished ? new Date() : null,
    })
    .where(eq(syncRuns.id, run.id))
    .returning();

  const message = finished
    ? `Sync complete: ${counts.items} items, ${counts.comments} comments${errors.length ? `, ${errors.length} repo error(s)` : ""}.`
    : rateLimitResetAt
      ? `Paused for GitHub rate limit until ${rateLimitResetAt.toISOString()}.`
      : `Partial: ${done.size}/${run.repoIds.length} repos done. Call sync again to continue.`;
  return progress(saved!, message);
}
```

- [ ] **Step 4: Dev script — `scripts/sync.ts`**

```ts
import { syncStep } from "@/lib/sync/run";

for (;;) {
  const p = await syncStep({ trigger: "dashboard" });
  console.log(`[sync] ${p.status} ${p.reposDone}/${p.reposTotal} — ${p.message}`);
  if (p.status !== "partial" && p.status !== "running") break;
  if (p.rateLimitResetAt) break;
}
```

Run (after adding at least one repo in Task 6): `bun scripts/sync.ts`
Expected: one or more `partial` lines, then `done … Sync complete: N items, M comments.` Re-run immediately: `done` with small or zero counts (incremental). In Neon's SQL editor: `select column, count(*) from triage group by 1;` shows `inbox` and `done` rows only.

- [ ] **Step 5: Server action — append to `app/(app)/settings/actions.ts`**

```ts
import { syncStep, type SyncProgress } from "@/lib/sync/run";

export async function syncStepAction(): Promise<SyncProgress | { error: string }> {
  await requireSession();
  try {
    const result = await syncStep({ trigger: "dashboard" });
    revalidatePath("/settings");
    return result;
  } catch (error) {
    return { error: message(error) };
  }
}
```

(Place the import with the other imports at the top of the file.)

- [ ] **Step 6: Sync panel — `app/(app)/settings/sync-panel.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import type { SyncProgress } from "@/lib/sync/run";
import { syncStepAction } from "./actions";

export function SyncPanel({ initial }: { initial: SyncProgress | null }) {
  const [progress, setProgress] = useState<SyncProgress | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    setError(null);
    startTransition(async () => {
      for (let i = 0; i < 50; i++) {
        const result = await syncStepAction();
        if ("error" in result) {
          setError(result.error);
          return;
        }
        setProgress(result);
        if (result.status !== "partial" || result.rateLimitResetAt) return;
      }
    });
  }

  const pct = progress && progress.reposTotal > 0 ? Math.round((progress.reposDone / progress.reposTotal) * 100) : 0;

  return (
    <div className="flex flex-col gap-3 rounded-md border border-hairline p-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-body-sm text-slate">
          {progress ? progress.message || `Last sync: ${progress.status}` : "Never synced."}
        </p>
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="shrink-0 rounded-md bg-primary px-4 py-2 text-body-sm font-medium text-on-primary transition-colors duration-150 hover:bg-primary-pressed disabled:opacity-60"
        >
          {pending ? "Syncing…" : "Sync now"}
        </button>
      </div>
      {pending && progress && (
        <div className="h-1.5 w-full overflow-hidden rounded-xs bg-surface">
          <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}
      {progress?.errors.map((e) => (
        <p key={e.repo} className="text-caption text-semantic-error">
          {e.repo}: {e.message}
        </p>
      ))}
      {error && <p className="text-body-sm text-semantic-error">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 7: Render it — modify `app/(app)/settings/page.tsx`**

Add imports:
```tsx
import { getLatestSync } from "@/lib/sync/run";
import { SyncPanel } from "./sync-panel";
```
Add below `export const dynamic = "force-dynamic";`:
```tsx
export const maxDuration = 60;
```
In `SettingsPage`, fetch both in parallel:
```tsx
const [repos, latestSync] = await Promise.all([listRepos(), getLatestSync()]);
```
And insert before the Repositories `<section>`:
```tsx
<section className="flex flex-col gap-3">
  <h2 className="text-heading-5 text-ink">Sync</h2>
  <SyncPanel initial={latestSync} />
</section>
```

- [ ] **Step 8: Verify**

Run: `bun test && bunx tsc --noEmit && bun run build` — Expected: PASS.

Manual: `bun run dev`, Settings → **Sync now**. Progress bar advances; ends with "Sync complete: …". Each repo row shows "synced just now". Add a bad repo row directly in SQL (`insert into repos (owner, name) values ('asyncapi','does-not-exist')`) and sync → its error shows under the panel and on the row; other repos still sync. Delete that row.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add resumable GitHub sync with settings panel"
```

---

### Task 10: Deploy button, docs, final verification

**Files:**
- Modify: `README.md` (rewrite), `AGENTS.md` (update for v2)

**Interfaces:**
- Consumes: everything above.
- Produces: one-click deploy instructions; updated agent guidance.

- [ ] **Step 1: Rewrite `README.md`**

````markdown
# gibit

A personal triage board for open-source maintainers, shared with Claude.
Gibit syncs issues and PRs from the repos you choose (read-only) into your own
Postgres, and gives you — and Claude, over MCP — one place to see what needs
your attention. Gibit never writes to GitHub.

## Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FSouvikns%2Fgibit&env=GITHUB_TOKEN,ADMIN_PASSWORD,GIBIT_SECRET&envDescription=GitHub%20read-only%20PAT%2C%20dashboard%20password%2C%20and%20a%20random%20secret%20for%20Claude&envLink=https%3A%2F%2Fgithub.com%2FSouvikns%2Fgibit%23environment-variables&stores=%5B%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22neon%22%2C%22productSlug%22%3A%22neon%22%2C%22protocol%22%3A%22storage%22%7D%5D)

The button clones the repo, provisions a Neon Postgres database, and asks for
three environment variables. Migrations run automatically during the build.

### Environment variables

| Variable | What to put |
|---|---|
| `GITHUB_TOKEN` | A fine-grained PAT with **read-only** access to Issues, Pull requests, and Metadata on your repos. |
| `ADMIN_PASSWORD` | The password for the dashboard. Changing it signs out every session. |
| `GIBIT_SECRET` | A random string for Claude's MCP access: `openssl rand -hex 32`. |
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED` | Set by the Neon integration. |

## Use

1. Open your deployment, sign in, go to **Settings**, add repos.
2. Click **Sync now**.

## Develop

```bash
cp .env.example .env.local   # fill in a dev Neon DB + PAT
bun install
bun run db:migrate
bun run dev
```

Checks: `bun test`, `bunx tsc --noEmit`, `bun run build`.
After changing `lib/db/schema.ts`: `bun run db:generate` and commit `drizzle/`.
````

- [ ] **Step 2: Update `AGENTS.md`**

Replace the file with:
````markdown
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
- Pure logic (`lib/model.ts`, `lib/github/map.ts`, `lib/github/names.ts`,
  `lib/sync/rules.ts`, `lib/sync/plan.ts`, `lib/auth/session.ts`,
  `lib/auth/rate-limit.ts`, `lib/time.ts`, `lib/labels.ts`) is unit-tested and
  must stay free of DB/network access.
- `db()` is lazy; never touch the DB at module top level.
- Path alias `@/*` → repo root. tsconfig is extra strict
  (`noUncheckedIndexedAccess`).
````

- [ ] **Step 3: Full verification**

Run: `bun test && bunx tsc --noEmit && bun run build`
Expected: all tests PASS (labels, time, model, session, rate-limit, names, graphql, map, rules, plan); tsc clean; build succeeds.

- [ ] **Step 4: Deploy check (manual, record results in the PR description)**

1. Push the branch; open the README Deploy button URL in a browser (pointing at the branch's repo).
2. Confirm the Neon store prompt appears. If it does not, swap `stores=` for `products=` in the button URL (same JSON) and retry; keep whichever works.
3. Confirm the build log shows `[migrate] Migrations applied.` and the deployment loads `/login`.
4. Sign in, add one repo, **Sync now** → completes.

- [ ] **Step 5: Commit**

```bash
git add README.md AGENTS.md
git commit -m "docs: document v2 deploy and architecture"
```
