import { syncStep } from "@/lib/sync/run";

for (;;) {
  const p = await syncStep({ trigger: "dashboard" });
  console.log(`[sync] ${p.status} ${p.reposDone}/${p.reposTotal} — ${p.message}`);
  if (p.status !== "partial" && p.status !== "running") break;
  if (p.rateLimitResetAt) break;
}
