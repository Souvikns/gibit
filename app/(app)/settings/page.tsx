import { headers } from "next/headers";
import { relativeTime } from "@/lib/time";
import { listRepos } from "@/lib/repos";
import { getLatestSync } from "@/lib/sync/run";
import { removeRepoAction, toggleRepoAction } from "./actions";
import { ConnectClaude } from "./connect-claude";
import { AddFromOwnerForm, AddRepoForm } from "./repo-forms";
import { SyncPanel } from "./sync-panel";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function SettingsPage() {
  const [repos, latestSync, h] = await Promise.all([listRepos(), getLatestSync(), headers()]);
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return (
    <div className="flex flex-col gap-10">
      <h1 className="text-heading-3 text-ink">Settings</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-heading-5 text-ink">Sync</h2>
        <SyncPanel initial={latestSync} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-heading-5 text-ink">Connect Claude</h2>
        <ConnectClaude origin={`${proto}://${host}`} />
      </section>

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
