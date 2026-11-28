import { sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db/client";

/** How long things are kept. Override per run with scripts/prune.ts flags. */
export interface Retention {
  /** Closed/merged items sitting in `done` longer than this are deleted (with their comments, notes, drafts…). */
  doneDays: number;
  /** Sync's own activity entries. */
  syncActivityDays: number;
  /** Claude's and the owner's activity entries. */
  activityDays: number;
  /** Discarded or copied drafts. */
  usedDraftDays: number;
  /** Newest reports kept. */
  keepReports: number;
  /** Newest finished sync runs kept. */
  keepSyncRuns: number;
}

export const DEFAULT_RETENTION: Retention = {
  doneDays: 30,
  syncActivityDays: 14,
  activityDays: 90,
  usedDraftDays: 30,
  keepReports: 60,
  keepSyncRuns: 50,
};

const DAY_MS = 86_400_000;

export function cutoff(days: number, now: number): Date {
  return new Date(now - days * DAY_MS);
}

interface Rule {
  label: string;
  /** SQL that selects the ids to delete from `table`. */
  ids: SQL;
  table: string;
}

function rules(r: Retention, now: number): Rule[] {
  const done = cutoff(r.doneDays, now).toISOString();
  const syncAct = cutoff(r.syncActivityDays, now).toISOString();
  const act = cutoff(r.activityDays, now).toISOString();
  const drafts = cutoff(r.usedDraftDays, now).toISOString();
  const attempts = cutoff(1, now).toISOString();
  return [
    {
      label: `closed items in done > ${r.doneDays}d (cascades comments, mentions, notes, drafts, activity)`,
      table: "items",
      ids: sql`select i.id from items i join triage t on t.item_id = i.id
               where t."column" = 'done' and i.state <> 'open'
                 and coalesce(i.merged_at, i.closed_at, i.updated_at) < ${done}::timestamptz`,
    },
    {
      label: `sync activity > ${r.syncActivityDays}d`,
      table: "activity_log",
      ids: sql`select id from activity_log where actor = 'sync' and created_at < ${syncAct}::timestamptz`,
    },
    {
      label: `claude/owner activity > ${r.activityDays}d`,
      table: "activity_log",
      ids: sql`select id from activity_log where actor <> 'sync' and created_at < ${act}::timestamptz`,
    },
    {
      label: `discarded/copied drafts > ${r.usedDraftDays}d`,
      table: "drafts",
      ids: sql`select id from drafts where status in ('discarded', 'copied') and updated_at < ${drafts}::timestamptz`,
    },
    {
      label: `reports beyond newest ${r.keepReports}`,
      table: "reports",
      ids: sql`select id from reports order by created_at desc offset ${r.keepReports}`,
    },
    {
      label: `finished sync runs beyond newest ${r.keepSyncRuns}`,
      table: "sync_runs",
      ids: sql`select id from sync_runs where status in ('done', 'failed') order by id desc offset ${r.keepSyncRuns}`,
    },
    {
      label: "expired login attempts",
      table: "login_attempts",
      ids: sql`select ip as id from login_attempts where window_start < ${attempts}::timestamptz`,
    },
  ];
}

export interface PruneResult {
  label: string;
  count: number;
}

/** Counts (dryRun) or deletes rows past retention. Rules run in order; item deletes cascade first. */
export async function prune(retention: Retention, opts: { dryRun: boolean; now?: number }): Promise<PruneResult[]> {
  const now = opts.now ?? Date.now();
  const results: PruneResult[] = [];
  for (const rule of rules(retention, now)) {
    const key = rule.table === "login_attempts" ? sql.raw("ip") : sql.raw("id");
    const table = sql.raw(rule.table);
    const res = opts.dryRun
      ? await db().execute(sql`select count(*)::int as count from (${rule.ids}) x`)
      : await db().execute(sql`with gone as (delete from ${table} where ${key} in (${rule.ids}) returning 1)
                               select count(*)::int as count from gone`);
    const count = Number((res.rows[0] as { count?: number } | undefined)?.count ?? 0);
    results.push({ label: rule.label, count });
  }
  return results;
}

export async function databaseSize(): Promise<string> {
  const res = await db().execute(sql`select pg_size_pretty(pg_database_size(current_database())) as size`);
  return String((res.rows[0] as { size?: string } | undefined)?.size ?? "unknown");
}
