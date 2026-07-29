"use client";

export default function OrgError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center px-6 py-24 text-center">
      <h1 className="text-heading-1 text-ink">Something went wrong</h1>
      <p className="mt-4 text-body-md text-slate">
        An unexpected error occurred while loading this page.
      </p>
      <button
        onClick={reset}
        className="mt-8 rounded-md bg-primary px-[18px] py-2.5 text-body-sm font-medium text-on-primary transition-colors duration-150 hover:bg-primary-pressed"
      >
        Try again
      </button>
    </main>
  );
}
