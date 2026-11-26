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
