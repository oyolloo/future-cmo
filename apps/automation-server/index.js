/**
 * Future CMO Automation Server
 *
 * Central reusable server for all persistent/scheduled automation:
 *   - WhatsApp (Baileys sockets per workspace)
 *   - Email (nodemailer SMTP per workspace)
 *   - SMS (BulkSMSBD HTTP)
 *   - Schedulers: BizLeads jobs, Checkout follow-ups, Reports, Courier sync
 *
 * Runs as a background process in the SAME Docker container as Next.js.
 * Next.js API routes proxy to this server on localhost:3001.
 *
 * Future channels (Facebook Messenger, Instagram DM, etc.) are added by
 * dropping a new file in channels/ and registering routes here.
 */
import express from 'express';
import * as wa from './channels/whatsapp.js';
import { sendEmail, getEmailStatus } from './channels/email.js';
import { validateEmails } from './channels/email-validator.js';
import { sendSms } from './channels/sms.js';
import { startJobRunner } from './scheduler/job-runner.js';
import { startCheckoutFollowup } from './scheduler/checkout-followup.js';
import { startReportScheduler } from './scheduler/reports.js';
import { startCourierSync } from './scheduler/courier-sync.js';

const app = express();
app.use(express.json());

const PORT = process.env.AUTOMATION_PORT || 3001;
const SECRET = process.env.AUTOMATION_SECRET || 'dev-secret';

// ── Auth (shared secret from Next.js, internal only) ─────────────────────────

function auth(req, res, next) {
  const token = req.headers['x-auto-secret'] || req.query.secret;
  if (token !== SECRET) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  next();
}

// ── CORS (internal — Next.js calls from same container) ──────────────────────

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'content-type, x-auto-secret');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ── WhatsApp routes ──────────────────────────────────────────────────────────

app.post('/wa/connect', auth, async (req, res) => {
  const r = await wa.connect(req.body.workspace_id || 'default');
  res.json(r);
});

app.get('/wa/status/:wsId', auth, async (req, res) => {
  const r = await wa.getStatus(req.params.wsId);
  res.json(r);
});

app.post('/wa/disconnect', auth, async (req, res) => {
  const r = await wa.disconnect(req.body.workspace_id || 'default');
  res.json(r);
});

app.post('/wa/send', auth, async (req, res) => {
  const { workspace_id, phone, message, typing_effect } = req.body;
  const r = await wa.send(workspace_id || 'default', phone, message, { typingEffect: typing_effect });
  res.status(r.ok ? 200 : 409).json(r);
});

// ── Email routes ─────────────────────────────────────────────────────────────

app.post('/email/send', auth, async (req, res) => {
  const { workspace_id, to, subject, body } = req.body;
  const r = await sendEmail(workspace_id, { to, subject, body });
  res.json(r);
});

app.get('/email/status/:wsId', auth, async (req, res) => {
  const r = await getEmailStatus(req.params.wsId);
  res.json(r);
});

// ── Email validation routes ─────────────────────────────────────────────────

app.post('/email/validate', auth, async (req, res) => {
  const raw = req.body?.emails;
  if (!raw || typeof raw !== 'string') {
    return res.status(400).json({ ok: false, error: "Missing 'emails' field (comma-separated)" });
  }
  const emails = raw.split(',').map((e) => e.trim()).filter(Boolean);
  if (!emails.length) {
    return res.status(400).json({ ok: false, error: 'No valid emails provided' });
  }
  try {
    const results = await validateEmails(emails);
    res.json({ ok: true, data: { results } });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || 'Validation failed' });
  }
});

// ── SMS routes ───────────────────────────────────────────────────────────────

app.post('/sms/send', auth, async (req, res) => {
  const { to, message } = req.body;
  const r = await sendSms(to, message);
  res.json(r);
});

// ── Health ───────────────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({ ok: true, uptime: process.uptime(), channels: ['whatsapp', 'email', 'email-validator', 'sms'] });
});

// ── Start server + all schedulers ────────────────────────────────────────────

app.listen(PORT, async () => {
  console.log(`[automation-server] listening on :${PORT}`);
  startJobRunner();
  startCheckoutFollowup();
  startReportScheduler();
  startCourierSync();
  console.log('[automation-server] all schedulers started');

  // Auto-reconnect WhatsApp sessions that have saved creds from previous runs.
  // The /data/wa/ volume persists across deploys — each subdirectory is a workspace.
  try {
    const { readdirSync, existsSync } = await import('fs');
    const authDir = process.env.WA_AUTH_DIR || '/data/wa';
    if (existsSync(authDir)) {
      const dirs = readdirSync(authDir).filter((d) => /^\d+$/.test(d));
      for (const wsId of dirs) {
        console.log(`[wa] auto-reconnecting ws:${wsId} from saved creds...`);
        wa.connect(wsId).catch((e) => console.error(`[wa] auto-reconnect ws:${wsId} failed`, e.message));
      }
    }
  } catch (e) { console.error('[wa] auto-reconnect scan failed', e.message); }
});
