import { getOwnerLogin } from "@/lib/github/owner";
import { boardItems } from "@/lib/triage/service";
import { getLatestSync } from "@/lib/sync/run";
import { Board } from "./board";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function BoardPage() {
  const [items, owner, latestSync] = await Promise.all([
    boardItems(),
    getOwnerLogin().catch(() => ""),
    getLatestSync(),
  ]);
  return <Board initialItems={items} owner={owner} lastSyncStatus={latestSync?.status ?? null} />;
}
