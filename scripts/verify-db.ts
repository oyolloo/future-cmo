import { config } from "dotenv";
import postgres from "postgres";

config({ path: "apps/web/.env" });

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");

async function main() {
  const sql = postgres(url!, { prepare: false });

  const rows = await sql<{ table_name: string; column_count: number }[]>`
    SELECT table_name, COUNT(column_name)::int AS column_count
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name NOT LIKE '__drizzle%'
    GROUP BY table_name
    ORDER BY table_name;
  `;

  console.log("Tables in public schema:");
  for (const r of rows) {
    console.log(`  - ${r.table_name} (${r.column_count} columns)`);
  }

  const idx = await sql<{ indexname: string; tablename: string }[]>`
    SELECT indexname, tablename
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename NOT LIKE '__drizzle%'
    ORDER BY tablename, indexname;
  `;

  console.log("\nIndexes:");
  for (const r of idx) {
    console.log(`  - ${r.tablename}.${r.indexname}`);
  }

  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
