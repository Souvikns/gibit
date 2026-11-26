import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.warn("[migrate] No DATABASE_URL(_UNPOOLED) set — skipping migrations.");
  process.exit(0);
}
await migrate(drizzle({ client: neon(url) }), { migrationsFolder: "./drizzle" });
console.log("[migrate] Migrations applied.");
