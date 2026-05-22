import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// .env lives with the Next.js app — single source of truth.
config({ path: "../../apps/web/.env" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set (looked in apps/web/.env)");
}

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  strict: true,
  verbose: true,
});
