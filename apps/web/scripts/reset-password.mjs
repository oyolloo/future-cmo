#!/usr/bin/env node
/**
 * One-off password reset script.
 *
 * Usage (from apps/web):
 *   node scripts/reset-password.mjs <email> <new-password>
 *
 * Reads DATABASE_URL from .env, hashes the password with bcrypt
 * (10 rounds, same as sign-up), updates the users row, and exits.
 */

import { config } from "dotenv";
import bcrypt from "bcryptjs";
import postgres from "postgres";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", ".env") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set in apps/web/.env");
  process.exit(1);
}

const [, , email, password] = process.argv;
if (!email || !password) {
  console.error("Usage: node scripts/reset-password.mjs <email> <password>");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { prepare: false });

try {
  const hash = await bcrypt.hash(password, 10);
  const rows = await sql`
    update users
    set password_hash = ${hash}, updated_at = now()
    where lower(email) = lower(${email})
    returning id, email
  `;

  if (rows.length === 0) {
    console.error(`No user found with email: ${email}`);
    process.exit(1);
  }

  console.log(`✓ Password reset for ${rows[0].email} (id: ${rows[0].id})`);
} finally {
  await sql.end();
}
