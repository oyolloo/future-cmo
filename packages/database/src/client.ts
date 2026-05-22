import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// Supabase pooler (port 6543, PgBouncer transaction mode) does not support
// prepared statements; `prepare: false` is required.
// HMR in dev creates a new module instance per reload, exhausting connections.
// Cache the client on globalThis in non-production runtimes.
type DbClient = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as unknown as {
  __kitDb?: DbClient;
  __kitSql?: ReturnType<typeof postgres>;
};

const sql =
  globalForDb.__kitSql ?? postgres(connectionString, { prepare: false });

export const db: DbClient =
  globalForDb.__kitDb ?? drizzle(sql, { schema });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__kitSql = sql;
  globalForDb.__kitDb = db;
}
