import { getTableColumns, sql, type SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";

/** `set` clause for multi-row upserts: every column except `skip` takes the incoming (excluded) value. */
export function excludedSet<T extends PgTable>(table: T, skip: string[] = []): Record<string, SQL> {
  const columns = getTableColumns(table);
  return Object.fromEntries(
    Object.entries(columns)
      .filter(([key]) => !skip.includes(key))
      .map(([key, column]) => [key, sql.raw(`excluded."${column.name}"`)]),
  );
}
