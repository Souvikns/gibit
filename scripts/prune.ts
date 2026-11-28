// Deletes old data to keep the database small. Dry run by default.
//
//   bun scripts/prune.ts                 # show what would be deleted
//   bun scripts/prune.ts --apply         # delete it
//   bun scripts/prune.ts --done-days=14  # override a retention window
//
// Flags: --done-days, --sync-activity-days, --activity-days, --used-draft-days,
//        --keep-reports, --keep-sync-runs. Uses DATABASE_URL from .env.local.
import { DEFAULT_RETENTION, databaseSize, prune, type Retention } from "@/lib/prune";

const FLAGS: Record<string, keyof Retention> = {
  "--done-days": "doneDays",
  "--sync-activity-days": "syncActivityDays",
  "--activity-days": "activityDays",
  "--used-draft-days": "usedDraftDays",
  "--keep-reports": "keepReports",
  "--keep-sync-runs": "keepSyncRuns",
};

const retention: Retention = { ...DEFAULT_RETENTION };
let apply = false;
for (const arg of process.argv.slice(2)) {
  if (arg === "--apply") {
    apply = true;
    continue;
  }
  const [flag, raw] = arg.split("=");
  const key = flag ? FLAGS[flag] : undefined;
  const value = Number(raw);
  if (!key || !Number.isInteger(value) || value < 0) {
    console.error(`Unknown or invalid argument: ${arg}`);
    process.exit(1);
  }
  retention[key] = value;
}

const host = (() => {
  try {
    return new URL(process.env.DATABASE_URL ?? "").host;
  } catch {
    return "(DATABASE_URL not set)";
  }
})();

console.log(`Database: ${host}`);
console.log(`Size before: ${await databaseSize()}`);
console.log(apply ? "Deleting:" : "Dry run — would delete (re-run with --apply):");

const results = await prune(retention, { dryRun: !apply });
for (const r of results) console.log(`  ${String(r.count).padStart(6)}  ${r.label}`);

if (apply) {
  console.log(`Size after: ${await databaseSize()}`);
  console.log("Postgres reuses freed space for new rows; the size may not drop right away.");
}
