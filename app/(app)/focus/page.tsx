import { getOwnerLogin } from "@/lib/github/owner";
import { getLatestSync } from "@/lib/sync/run";
import { focusItems } from "@/lib/triage/service";
import { Focus } from "./focus";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function FocusPage() {
  const [items, owner, latestSync] = await Promise.all([
    focusItems(),
    getOwnerLogin().catch(() => ""),
    getLatestSync(),
  ]);
  return <Focus initialItems={items} owner={owner} now={Date.now()} lastSyncStatus={latestSync?.status ?? null} />;
}
