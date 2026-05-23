export { db } from "./client";
export * as schema from "./schema";
export * from "./schema";
export * from "./queries";

// Re-export commonly used Drizzle query helpers so consumer apps don't need
// drizzle-orm as a direct dependency. Turbopack already transpiles @kit/database
// via apps/web/next.config.ts, so this avoids monorepo symlink resolution
// edge cases in dev.
export {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  like,
  lt,
  lte,
  ne,
  notInArray,
  or,
  sql,
} from "drizzle-orm";
