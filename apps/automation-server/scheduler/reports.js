/**
 * Scheduled reports runner.
 * Polls report_configs where next_run_at <= now(), generates and emails the report.
 */
import { query, queryOne } from '../db.js';
import { sendEmail } from '../channels/email.js';

const INTERVAL = 5 * 60_000; // every 5 min

async function processDueReports() {
  try {
    const configs = await query(
      `SELECT * FROM report_configs WHERE next_run_at <= now() AND is_active = true LIMIT 5`);

    for (const cfg of configs) {
      try {
        const recipients = cfg.recipients || [];
        if (!recipients.length) continue;

        // Build a simple summary from the workspace (placeholder — the actual
        // report generation logic lives in the Next.js reports service).
        const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://app.oyolloo.com';
        const subject = `${cfg.frequency === 'monthly' ? 'Monthly' : 'Weekly'} Report — ${cfg.name || 'Future CMO'}`;
        const body = `<p>Your ${cfg.frequency} report is ready. <a href="${appUrl}/reports">View on Future CMO</a></p>`;

        for (const to of recipients) {
          await sendEmail(String(cfg.workspace_id), { to, subject, body });
        }

        // Compute next run.
        const interval = cfg.frequency === 'monthly' ? '1 month' : '7 days';
        await query(
          `UPDATE report_configs SET last_run_at=now(), next_run_at=now()+'${interval}'::interval WHERE id=$1`,
          [cfg.id]);
        console.log(`[reports] sent ${cfg.name} to ${recipients.length} recipients`);
      } catch (err) {
        console.error(`[reports] config ${cfg.id} failed`, err.message);
      }
    }
  } catch (err) {
    // Table may not exist yet — fine.
    if (!err.message?.includes('does not exist')) console.error('[reports] error', err.message);
  }
}

export function startReportScheduler() {
  console.log('[reports] started (5min interval)');
  setInterval(processDueReports, INTERVAL);
}
