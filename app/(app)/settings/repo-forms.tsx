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
