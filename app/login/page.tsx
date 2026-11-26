import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-6">
      <div className="w-full max-w-sm rounded-xl border border-hairline bg-canvas p-8">
        <h1 className="text-heading-4 text-ink">gibit</h1>
        <p className="mt-1 text-body-sm text-slate">Sign in to your triage board.</p>
        <LoginForm next={next ?? "/"} />
      </div>
    </main>
  );
}
