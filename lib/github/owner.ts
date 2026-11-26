import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { appState } from "@/lib/db/schema";
import { graphql } from "./graphql";
import { VIEWER_QUERY } from "./queries";

/** The login behind GITHUB_TOKEN — "me" everywhere in gibit. Cached in app_state. */
export async function getOwnerLogin(): Promise<string> {
  const [row] = await db().select().from(appState).where(eq(appState.key, "owner_login"));
  if (row) return row.value;
  const { viewer } = await graphql<{ viewer: { login: string } }>(VIEWER_QUERY);
  await db()
    .insert(appState)
    .values({ key: "owner_login", value: viewer.login })
    .onConflictDoUpdate({ target: appState.key, set: { value: viewer.login } });
  return viewer.login;
}
