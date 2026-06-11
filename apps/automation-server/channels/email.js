/**
 * Email channel — per-workspace SMTP sender (reusable).
 * Reads SMTP config from bizleads_settings, decrypts password, sends via nodemailer.
 */
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import { queryOne } from '../db.js';

// ── Encryption (mirrors @kit/shared/encryption — uses same JWT_SECRET) ──────

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

function getKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET required for decryption');
  return crypto.createHmac('sha256', secret).update('futurecmo.addon.v1').digest();
}

function decrypt(payload) {
  if (!payload) return '';
  const buf = Buffer.from(payload, 'base64');
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const enc = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

// ── Provider presets ─────────────────────────────────────────────────────────

const PRESETS = {
  gmail:     { host: 'smtp.gmail.com',       port: 465, secure: true },
  outlook:   { host: 'smtp.office365.com',   port: 587, secure: false },
  zoho:      { host: 'smtp.zoho.com',        port: 465, secure: true },
  hostinger: { host: 'smtp.hostinger.com',   port: 465, secure: true },
  yahoo:     { host: 'smtp.mail.yahoo.com',  port: 465, secure: true },
  icloud:    { host: 'smtp.mail.me.com',     port: 587, secure: false },
  yandex:    { host: 'smtp.yandex.com',      port: 465, secure: true },
  fastmail:  { host: 'smtp.fastmail.com',    port: 465, secure: true },
};

// ── Load workspace SMTP config ───────────────────────────────────────────────

async function loadSmtpConfig(wsId) {
  const row = await queryOne('SELECT data FROM bizleads_settings WHERE workspace_id=$1', [wsId]);
  const data = row?.data || {};
  const host = data.smtpHost;
  const user = data.smtpUser;
  const pass = data.smtpPass ? decrypt(data.smtpPass) : '';
  if (!host || !user || !pass) return null;
  return {
    host,
    port: typeof data.smtpPort === 'number' ? data.smtpPort : 587,
    secure: typeof data.smtpSecure === 'boolean' ? data.smtpSecure : (data.smtpPort === 465),
    user,
    pass,
    fromName: data.smtpFromName || user,
  };
}

// ── Send ─────────────────────────────────────────────────────────────────────

export async function sendEmail(wsId, { to, subject, body }) {
  const cfg = await loadSmtpConfig(wsId);
  if (!cfg) return { ok: false, error: 'Email not configured — connect SMTP first' };

  const transporter = nodemailer.createTransport({
    host: cfg.host, port: cfg.port, secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
    connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000,
  });

  const from = cfg.fromName ? `"${cfg.fromName}" <${cfg.user}>` : cfg.user;

  // List-Unsubscribe header (CAN-SPAM compliance + inbox placement boost).
  const unsubLink = `mailto:${cfg.user}?subject=Unsubscribe`;
  const headers = {
    'List-Unsubscribe': `<${unsubLink}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };

  // Append unsubscribe footer to HTML body.
  const footer = `<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center">
    <a href="${unsubLink}" style="color:#9ca3af;text-decoration:underline">Unsubscribe</a>
  </div>`;
  const htmlBody = (body || '') + footer;

  try {
    const info = await transporter.sendMail({ from, to, subject, html: htmlBody, headers });
    return { ok: true, messageId: info.messageId || '' };
  } catch (err) {
    return { ok: false, error: err.message || 'Send failed' };
  }
}

export async function getEmailStatus(wsId) {
  const cfg = await loadSmtpConfig(wsId);
  return {
    connected: !!cfg,
    provider: cfg ? undefined : null,
    user: cfg?.user || null,
    fromName: cfg?.fromName || null,
    host: cfg?.host || null,
  };
}

export { PRESETS as smtpPresets };
