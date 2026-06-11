/**
 * BizLeads job runner — polls bizleads_jobs every 60s, executes due jobs.
 * Sends via the WhatsApp or Email channel, deducts credits, logs results.
 */
import { pool, query, queryOne } from '../db.js';
import { send as waSend } from '../channels/whatsapp.js';
import { sendEmail } from '../channels/email.js';

const INTERVAL = 60_000;

async function deductCredit(wsId, channel) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query('SELECT balance FROM bizleads_credits WHERE workspace_id=$1 FOR UPDATE', [wsId]);
    const balance = r.rows[0] ? parseInt(r.rows[0].balance, 10) : 0;
    if (balance <= 0) { await client.query('ROLLBACK'); return false; }
    await client.query('UPDATE bizleads_credits SET balance=balance-1, updated_at=now() WHERE workspace_id=$1', [wsId]);
    await client.query(
      'INSERT INTO bizleads_credit_tx (workspace_id,delta,reason) VALUES ($1,-1,$2)', [wsId, channel]);
    await client.query('COMMIT');
    return true;
  } catch { await client.query('ROLLBACK').catch(() => {}); return false; }
  finally { client.release(); }
}

async function runDueJobs() {
  try {
    // Claim due jobs atomically.
    const jobs = await query(
      `UPDATE bizleads_jobs SET status='running', last_run_at=now(), attempts=attempts+1, updated_at=now()
       WHERE id IN (
         SELECT id FROM bizleads_jobs WHERE status='pending' AND COALESCE(next_run_at,run_at) <= now()
         ORDER BY COALESCE(next_run_at,run_at) LIMIT 10 FOR UPDATE SKIP LOCKED
       ) RETURNING *`);

    for (const job of jobs) {
      const recipients = job.payload?.recipients || [];
      const delaySec = job.payload?.delaySec || 10;
      let sent = 0, failed = 0;

      for (const r of recipients) {
        // Deduct 1 credit.
        const ok = await deductCredit(job.workspace_id, job.channel);
        if (!ok) {
          await query(`INSERT INTO bizleads_job_log (job_id,status,message) VALUES ($1,'insufficient_credits','Stopped: no credits')`, [job.id]);
          break;
        }

        // Send.
        let result;
        if (job.channel === 'whatsapp') {
          result = await waSend(String(job.workspace_id), r.to, r.message);
        } else {
          result = await sendEmail(String(job.workspace_id), { to: r.to, subject: r.subject || '', body: r.message });
        }

        if (result.ok) sent++; else failed++;

        // Log per-recipient.
        await query(
          `INSERT INTO bizleads_job_log (job_id,status,message,data) VALUES ($1,$2,$3,$4::jsonb)`,
          [job.id, result.ok ? 'sent' : 'failed', result.error || null, JSON.stringify({ to: r.to, messageId: result.messageId })]);

        // Anti-ban delay between messages.
        if (recipients.indexOf(r) < recipients.length - 1) {
          await new Promise(res => setTimeout(res, delaySec * 1000));
        }
      }

      // Finalize job.
      const resultJson = JSON.stringify({ sent, failed });
      const recurring = job.recurrence === 'daily' || job.recurrence === 'weekly';
      if (recurring && failed < recipients.length) {
        const interval = job.recurrence === 'weekly' ? '7 days' : '1 day';
        await query(
          `UPDATE bizleads_jobs SET status='pending', next_run_at=COALESCE(next_run_at,run_at,now())+'${interval}'::interval, result=$2::jsonb, updated_at=now() WHERE id=$1`,
          [job.id, resultJson]);
      } else {
        await query('UPDATE bizleads_jobs SET status=$2, result=$3::jsonb, updated_at=now() WHERE id=$1',
          [job.id, failed >= recipients.length ? 'failed' : 'done', resultJson]);
      }
    }
  } catch (err) {
    console.error('[job-runner] error', err.message);
  }
}

export function startJobRunner() {
  console.log('[job-runner] started (60s interval)');
  setInterval(runDueJobs, INTERVAL);
  runDueJobs(); // run once immediately
}
