/**
 * Shared Postgres pool — reads DATABASE_URL from the same env as Next.js.
 */
import pg from 'pg';
const { Pool } = pg;

// Supabase (and most managed Postgres) require TLS; local dev doesn't.
const url = process.env.DATABASE_URL || '';
const isLocal = /localhost|127\.0\.0\.1/.test(url);

export const pool = new Pool({
  connectionString: url,
  ssl: isLocal ? undefined : { rejectUnauthorized: false },
});

export async function query(text, params) {
  const { rows } = await pool.query(text, params);
  return rows;
}

export async function queryOne(text, params) {
  const { rows } = await pool.query(text, params);
  return rows[0] || null;
}
