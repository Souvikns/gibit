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
| `GITHUB_TOKEN` | A fine-grained PAT with **read-only** access to Issues, Pull requests, and Metadata on your repos. Some orgs reject tokens with a lifetime over 366 days — pick a shorter expiry. |
| `ADMIN_PASSWORD` | The password for the dashboard. Changing it signs out every session. |
| `GIBIT_SECRET` | A random string for Claude's MCP access: `openssl rand -hex 32`. |
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED` | Set by the Neon integration. |

To rotate a value, change it in Vercel and redeploy. After rotating
`GIBIT_SECRET`, re-run the `claude mcp add` command below with the new value.

## Use

1. Open your deployment, sign in, go to **Settings**, and add repos — one at a
   time, or **List repos** for an org and tick the ones you want.
2. Click **Sync** (on the Board or in Settings). The first sync backfills all
   open items plus anything closed in the last 90 days; later syncs only fetch
   what changed.
3. Work the **Board**. Items flow through seven columns: Inbox, Needs my reply,
   Needs my review, Investigating, Waiting on others, Ready to close/merge,
   Done. Drag cards on desktop, or use **Move to** on mobile. Click a card for
   the thread, Claude's notes, and its draft reply — **Copy & open on GitHub**
   copies the draft so you can post it yourself.
4. Read Claude's summaries on **Reports**.

Sync only ever moves cards mechanically: new items land in Inbox, closed or
merged items go to Done, reopened items return to Inbox. Every other move is
yours or Claude's.

## Connect Claude Code

Settings → **Connect Claude** shows the exact command. It looks like:

```bash
claude mcp add --transport http gibit https://<your-deployment>/api/mcp \
  --header "Authorization: Bearer <GIBIT_SECRET>"
```

Then run the daily playbook in Claude Code:

```
/mcp__gibit__triage
```

Claude syncs, researches new items, moves cards on the board, saves research
notes and draft replies, and writes a report. It never writes to GitHub — you
post replies yourself.

Tools: `sync`, `list_repos`, `get_briefing`, `list_items`, `get_item`,
`list_reports`, `move_item`, `add_note`, `save_draft`, `save_report`.

The MCP endpoint uses a bearer token, so it works with **Claude Code**
(including Remote Control from your phone). Claude Desktop and mobile custom
connectors require OAuth and aren't supported yet.

### Run it on a server

Research is better when Claude can read the code. On a machine you keep on:

```bash
mkdir ~/gibit-work && cd ~/gibit-work
tmux new -s gibit
claude            # add the MCP server once, as above
```

Drive it from your phone with Claude Code Remote Control and run
`/mcp__gibit__triage`. The playbook clones each configured repo into that
directory (or pulls it) before researching.

## Keep the database small

Gibit fits comfortably in Neon's free tier (1 GB per project; a repo with a
few hundred items is ~5 MB). To trim old data, run from your machine with
`DATABASE_URL` in `.env.local` pointing at the database you want to clean:

```bash
bun run db:prune            # dry run: shows what would be deleted
bun run db:prune --apply    # delete it
```

It removes closed items that have been in Done for 30+ days (with their
comments, notes and drafts), sync activity older than 14 days, other activity
older than 90 days, used drafts older than 30 days, and all but the newest 60
reports and 50 sync runs. Override any window, e.g. `--done-days=14`; see
`scripts/prune.ts` for all flags. Closed items come back if they get new
activity on GitHub.

## Troubleshooting

- **"organization forbids access via a fine-grained personal access token"** —
  the org limits token lifetime; regenerate the PAT with a shorter expiry.
- **"GitHub rejected GITHUB_TOKEN (401)"** — the token was revoked, expired, or
  regenerated; update it in your environment.
- **Sync says "Paused for GitHub rate limit"** — wait until the time shown and
  sync again; it resumes where it stopped.
- **Claude gets 401 from `/api/mcp`** — the bearer value doesn't match
  `GIBIT_SECRET`; re-add the MCP server with the current secret.

## Develop

```bash
cp .env.example .env.local   # fill in a dev Neon DB + PAT
bun install
bun run db:migrate
bun run dev
```

Use a separate Neon database (or branch) for development — otherwise local
changes and the prune script act on your production data.

Checks: `bun test`, `bunx tsc --noEmit`, `bun run build`.
After changing `lib/db/schema.ts`: `bun run db:generate` and commit `drizzle/`.
`bun scripts/sync.ts` runs a full sync from the command line.
