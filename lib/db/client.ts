import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function create() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return drizzle({ client: neon(url), schema });
}

let cached: ReturnType<typeof create> | undefined;

/** Lazily created so importing modules never needs a DB at build time. */
export function db() {
  cached ??= create();
  return cached;
}

export type Db = ReturnType<typeof create>;
