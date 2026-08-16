/**
 * Shared Postgres pool — reads DATABASE_URL from the same env as Next.js.
 */
import pg from 'pg';
const { Pool } = pg;

const url = process.env.DATABASE_URL || '';

/**
 * Decides whether to negotiate TLS.
 *
 * Managed Postgres (Supabase and friends) requires it; a database container
 * sitting on the same private network generally has no certificate and
 * refuses the handshake outright — "The server does not support SSL
 * connections", which every scheduler tick then logged and died on.
 *
 * The previous rule only recognised localhost as private, so a compose or
 * Dokploy setup, where the host is a service name like `oyolloo-postgres-ab12`,
 * looked remote and had TLS forced onto it.
 *
 * DATABASE_SSL overrides the guess in either direction.
 */
function wantsTls(connectionString) {
  const override = (process.env.DATABASE_SSL || '').toLowerCase();
  if (override === 'true' || override === 'require') return true;
  if (override === 'false' || override === 'disable') return false;

  // An explicit sslmode in the URL is a stated intent, not a guess.
  const mode = connectionString.match(/[?&]sslmode=([a-z-]+)/i)?.[1]?.toLowerCase();
  if (mode) return mode !== 'disable' && mode !== 'allow';

  let host = '';
  try {
    host = new URL(connectionString).hostname;
  } catch {
    return false;
  }

  if (!host || host === 'localhost') return false;
  // Docker and Kubernetes service names have no dot; public hostnames do.
  if (!host.includes('.')) return false;
  // RFC1918 and loopback ranges are never reachable from outside the network.
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;

  return true;
}

const useTls = wantsTls(url);

export const pool = new Pool({
  connectionString: url,
  ssl: useTls ? { rejectUnauthorized: false } : undefined,
});

// Worth one line at boot: the failure this prevents is a connection error on
// every scheduler tick, which reads as a database outage rather than a
// transport mismatch.
console.log(`[db] TLS ${useTls ? 'enabled' : 'disabled'}`);

// A pool error with no listener takes the whole process down, and these
// schedulers are meant to outlive a dropped connection.
pool.on('error', (err) => {
  console.error('[db] idle client error:', err.message);
});

export async function query(text, params) {
  const { rows } = await pool.query(text, params);
  return rows;
}

export async function queryOne(text, params) {
  const { rows } = await pool.query(text, params);
  return rows[0] || null;
}
