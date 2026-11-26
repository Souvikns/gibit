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

## Develop

```bash
cp .env.example .env.local   # fill in a dev Neon DB + PAT
bun install
bun run db:migrate
bun run dev
```

Checks: `bun test`, `bunx tsc --noEmit`, `bun run build`.
After changing `lib/db/schema.ts`: `bun run db:generate` and commit `drizzle/`.
`bun scripts/sync.ts` runs a full sync from the command line.
