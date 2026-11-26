"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { clearAttempts, getAttempts, saveAttempts } from "@/lib/auth/attempts";
import { isBlocked, recordFailure } from "@/lib/auth/rate-limit";
import { adminPassword, setSessionCookie } from "@/lib/auth/server";
import { safeEqual, safeNextPath } from "@/lib/auth/session";

export interface LoginState {
  error: string | null;
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const expected = adminPassword();
  if (!expected) return { error: "ADMIN_PASSWORD is not configured on the server." };

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const record = await getAttempts(ip);
  const block = isBlocked(record, now);
  if (block.blocked) {
    return { error: `Too many attempts. Try again in ${Math.ceil(block.retryAfterMs / 60_000)} min.` };
  }

  const password = String(formData.get("password") ?? "");
  if (!(await safeEqual(password, expected))) {
    await saveAttempts(ip, recordFailure(record, now));
    return { error: "Wrong password." };
  }

  await clearAttempts(ip);
  await setSessionCookie();
  redirect(safeNextPath(String(formData.get("next") ?? "")));
}
