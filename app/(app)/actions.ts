"use server";

import { redirect } from "next/navigation";
import { clearSessionCookie } from "@/lib/auth/server";

export async function logout(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}
