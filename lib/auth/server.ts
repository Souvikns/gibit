import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, SESSION_MAX_AGE_S, signSession, verifySession } from "./session";

export function adminPassword(): string | null {
  return process.env.ADMIN_PASSWORD || null;
}

export async function setSessionCookie(): Promise<void> {
  const password = adminPassword();
  if (!password) throw new Error("ADMIN_PASSWORD is not set");
  const token = await signSession(password, Date.now() + SESSION_MAX_AGE_S * 1000);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_S,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Defense in depth for server actions and pages; proxy.ts is the first gate. */
export async function requireSession(): Promise<void> {
  const password = adminPassword();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!password || !token || !(await verifySession(password, token)).valid) redirect("/login");
}
