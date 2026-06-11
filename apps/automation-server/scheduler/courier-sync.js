/**
 * Courier tracking auto-sync.
 * Periodically refreshes tracking status for active (in-transit) shipments.
 * Lightweight — just marks stale records for the Next.js UI to refresh on demand.
 */
import { query } from '../db.js';

const INTERVAL = 15 * 60_000; // every 15 min

async function syncStaleTracking() {
  try {
    // Mark consignments that haven't been checked in 30+ min as stale,
    // so the dashboard shows a refresh prompt. Actual tracking API calls
    // happen in the Next.js courier service (stateless HTTP).
    await query(
      `UPDATE courier_consignments SET needs_refresh = true
       WHERE status NOT IN ('delivered','returned','cancelled')
         AND (last_tracked_at IS NULL OR last_tracked_at < now() - interval '30 minutes')
         AND needs_refresh IS NOT TRUE`);
  } catch (err) {
    // Table may not exist or column may not exist — fine, this is optional.
    if (!err.message?.includes('does not exist')) console.error('[courier-sync] error', err.message);
  }
}

export function startCourierSync() {
  console.log('[courier-sync] started (15min interval)');
  setInterval(syncStaleTracking, INTERVAL);
}
