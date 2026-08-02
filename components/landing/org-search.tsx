"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { SearchIcon } from "@/components/icons";

/** Accepts `vercel`, `@vercel`, or `https://github.com/vercel/...` → `vercel`. */
export function normalizeOrgInput(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\/(www\.)?github\.com\/?/i, "")
    .replace(/^@/, "")
    .split(/[\s/?#]/)[0]!
    .trim();
}

export function OrgSearch({ variant }: { variant: "hero" | "nav" }) {
  const router = useRouter();
  const [value, setValue] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    const org = normalizeOrgInput(value);
    if (org) router.push(`/${encodeURIComponent(org)}`);
  }

  if (variant === "nav") {
    return (
      <form onSubmit={submit} role="search" className="relative hidden sm:block">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-stone" />
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          type="search"
          aria-label="Search a GitHub organization"
          placeholder="Search another org…"
          className="h-9 w-52 rounded-md border border-hairline bg-surface pr-3 pl-9 text-body-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none lg:w-64"
        />
      </form>
    );
  }

  return (
    <form
      onSubmit={submit}
      role="search"
      className="mx-auto flex w-full max-w-xl flex-col gap-3 sm:flex-row"
    >
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
         type="search"
        aria-label="GitHub organization"
        placeholder="Enter a GitHub org — e.g. vercel"
        autoComplete="off"
        spellCheck={false}
        className="h-11 flex-1 rounded-md border border-hairline-strong bg-canvas px-4 text-body-md text-ink placeholder:text-muted focus:border-2 focus:border-primary focus:outline-none"
      />
      <button
        type="submit"
        className="h-11 shrink-0 rounded-md bg-primary px-[18px] text-body-sm font-medium text-on-primary transition-colors duration-150 hover:bg-primary-pressed active:bg-primary-pressed"
      >
        Search issues
      </button>
    </form>
  );
}
