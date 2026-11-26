import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { loginAttempts } from "@/lib/db/schema";
import type { AttemptRecord } from "./rate-limit";

export async function getAttempts(ip: string): Promise<AttemptRecord | null> {
  const [row] = await db().select().from(loginAttempts).where(eq(loginAttempts.ip, ip));
  return row ? { count: row.count, windowStart: row.windowStart.getTime() } : null;
}

export async function saveAttempts(ip: string, record: AttemptRecord): Promise<void> {
  const values = { ip, count: record.count, windowStart: new Date(record.windowStart) };
  await db()
    .insert(loginAttempts)
    .values(values)
    .onConflictDoUpdate({ target: loginAttempts.ip, set: { count: values.count, windowStart: values.windowStart } });
}

export async function clearAttempts(ip: string): Promise<void> {
  await db().delete(loginAttempts).where(eq(loginAttempts.ip, ip));
}
