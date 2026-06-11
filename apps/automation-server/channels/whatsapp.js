/**
 * WhatsApp channel — based on Super-Light-Web-WhatsApp-API-Server pattern.
 * https://github.com/Alucard0x1/Super-Light-Web-WhatsApp-API-Server
 *
 * Key differences from our previous implementation:
 * - Browsers.ubuntu('Chrome') fingerprint (matches a real browser)
 * - keepAliveIntervalMs: 25s, connectTimeoutMs: 60s, retryRequestDelayMs: 500ms
 * - Retry counter (max 5) instead of force flag — simpler, proven
 * - activeSockets map tracks sockets separately from session state
 * - 515 is treated as reconnectable (only 401/403/loggedOut stop retries)
 */
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  makeCacheableSignalKeyStore,
  Browsers,
  isJidBroadcast,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import * as QRCode from 'qrcode';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';

const AUTH_DIR = process.env.WA_AUTH_DIR || '/data/wa';
const silentLogger = {
  level: 'silent', info(){}, warn(){}, error(){}, debug(){}, trace(){}, fatal(){},
  child() { return silentLogger; },
};

// ── State ────────────────────────────────────────────────────────────────────

const activeSockets = new Map();   // wsId → WASocket
const retryCounters = new Map();   // wsId → number
const sessionState = new Map();    // wsId → { status, phone, qr, qrExpires }

function getState(wsId) {
  let s = sessionState.get(wsId);
  if (!s) {
    s = { status: 'disconnected', phone: null, qr: null, qrExpires: 0 };
    sessionState.set(wsId, s);
  }
  return s;
}

// ── Connect (matches Super-Light pattern) ────────────────────────────────────

export async function connect(wsId) {
  const s = getState(wsId);
  const sessionDir = join(AUTH_DIR, String(wsId));

  // If already connected, return immediately.
  const existingSocket = activeSockets.get(wsId);
  if (existingSocket?.user) {
    s.status = 'connected';
    return { ok: true, status: 'connected', phone: s.phone };
  }

  s.status = 'connecting';
  s.qr = null;
  console.log(`[wa] ws:${wsId} >>> connect() starting...`);

  try {
    mkdirSync(sessionDir, { recursive: true });
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

    let version;
    try {
      const v = await fetchLatestBaileysVersion();
      version = v.version;
      console.log(`[wa] ws:${wsId} >>> using WA version ${version.join('.')}`);
    } catch {
      version = undefined; // fallback to bundled
      console.log(`[wa] ws:${wsId} >>> using bundled WA version`);
    }

    const sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, silentLogger),
      },
      printQRInTerminal: false,
      logger: silentLogger,
      browser: Browsers.ubuntu('Chrome'),
      generateHighQualityLinkPreview: false,
      shouldIgnoreJid: (jid) => isJidBroadcast(jid),
      qrTimeout: 40_000,
      markOnlineOnConnect: true,
      syncFullHistory: false,
      retryRequestDelayMs: 500,
      maxMsgRetryCount: 3,
      connectTimeoutMs: 60_000,
      keepAliveIntervalMs: 25_000,
      defaultQueryTimeoutMs: undefined,
      getMessage: async () => ({ conversation: '' }),
    });

    activeSockets.set(wsId, sock);

    // ── creds.update ──────────────────────────────────────────────────
    sock.ev.on('creds.update', async () => {
      console.log(`[wa] ws:${wsId} >>> creds.update fired`);
      try { await saveCreds(); console.log(`[wa] ws:${wsId} >>> creds saved OK`); }
      catch (e) { console.error(`[wa] ws:${wsId} >>> saveCreds FAILED`, e.message); }
    });

    // ── connection.update (Super-Light pattern) ───────────────────────
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      console.log(`[wa] ws:${wsId} >>> connection.update`, JSON.stringify({ connection, qr: !!qr, isNewLogin: update.isNewLogin }).slice(0, 300));

      // QR generated — encode as data URL.
      if (qr) {
        try {
          s.qr = await QRCode.toDataURL(qr, { width: 256, margin: 2, errorCorrectionLevel: 'H' });
          s.qrExpires = Date.now() + 40_000;
          s.status = 'qr';
          console.log(`[wa] ws:${wsId} >>> QR encoded, status=qr`);
        } catch (e) { console.error(`[wa] ws:${wsId} >>> QR encode failed`, e.message); }
      }

      // Connection opened — success!
      if (connection === 'open') {
        s.status = 'connected';
        s.qr = null;
        s.phone = sock.user?.id?.split(':')[0]?.split('@')[0] || null;
        retryCounters.delete(wsId);
        console.log(`[wa] ws:${wsId} >>> CONNECTED! phone=${s.phone}`);
      }

      // Connection closed — reconnect unless logged out.
      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const reason = lastDisconnect?.error?.output?.payload?.message || 'Connection closed';
        console.log(`[wa] ws:${wsId} >>> CLOSED code=${statusCode} reason=${reason}`);

        s.status = 'disconnected';
        s.qr = null;
        activeSockets.delete(wsId);

        const shouldReconnect = statusCode !== DisconnectReason.loggedOut
          && statusCode !== 401
          && statusCode !== 403;

        if (shouldReconnect) {
          const retryCount = (retryCounters.get(wsId) || 0) + 1;
          retryCounters.set(wsId, retryCount);

          if (retryCount <= 5) {
            const delay = statusCode === 515 ? 1000 : 5000;
            console.log(`[wa] ws:${wsId} >>> reconnecting in ${delay}ms (attempt ${retryCount}/5)`);
            setTimeout(() => connect(wsId), delay);
          } else {
            console.log(`[wa] ws:${wsId} >>> max retries (5) reached — giving up`);
            retryCounters.delete(wsId);
          }
        } else {
          // Logged out or auth failure — wipe creds.
          console.log(`[wa] ws:${wsId} >>> cleaning session data (code=${statusCode})`);
          if (existsSync(sessionDir)) {
            rmSync(sessionDir, { recursive: true, force: true });
          }
          retryCounters.delete(wsId);
        }
      }
    });

    // Log messages to confirm socket is alive after connect.
    sock.ev.on('messages.upsert', (m) => {
      console.log(`[wa] ws:${wsId} >>> messages.upsert type=${m.type} count=${m.messages?.length}`);
    });

    return { ok: true, status: 'connecting' };
  } catch (err) {
    s.status = 'disconnected';
    activeSockets.delete(wsId);
    console.error(`[wa] ws:${wsId} >>> connect() FAILED`, err.message);
    return { ok: false, error: err.message || 'Failed to start session' };
  }
}

// ── Status ───────────────────────────────────────────────────────────────────

export async function getStatus(wsId) {
  const s = getState(wsId);
  return {
    ok: true,
    status: s.status,
    qr: s.qr,
    qrExpires: s.qrExpires,
    phone: s.phone,
    connected: s.status === 'connected',
    sentToday: 0, // TODO: read from DB
    dailyCap: 1000,
  };
}

// ── Disconnect ───────────────────────────────────────────────────────────────

export async function disconnect(wsId) {
  const s = getState(wsId);
  const sock = activeSockets.get(wsId);
  try { await sock?.logout(); } catch {}
  try { sock?.end(undefined); } catch {}
  activeSockets.delete(wsId);
  retryCounters.delete(wsId);
  s.status = 'disconnected'; s.phone = null; s.qr = null;

  const sessionDir = join(AUTH_DIR, String(wsId));
  if (existsSync(sessionDir)) {
    rmSync(sessionDir, { recursive: true, force: true });
  }
  sessionState.delete(wsId);
  return { ok: true, status: 'disconnected' };
}

// ── Send (with anti-ban typing + jitter) ─────────────────────────────────────

export async function send(wsId, phone, message, opts = {}) {
  const sock = activeSockets.get(wsId);
  if (!sock?.user) {
    return { ok: false, error: 'WhatsApp not connected' };
  }

  const digits = String(phone).replace(/[^\d]/g, '');
  const jid = `${digits}@s.whatsapp.net`;

  try {
    if (opts.typingEffect !== false) {
      await sock.presenceSubscribe(jid);
      await sock.sendPresenceUpdate('composing', jid);
      await new Promise(r => setTimeout(r, 1000 + Math.random() * 1500));
      await sock.sendPresenceUpdate('paused', jid);
    }
    const result = await sock.sendMessage(jid, { text: message });
    return { ok: true, messageId: result?.key?.id || '' };
  } catch (err) {
    console.error(`[wa] ws:${wsId} >>> send failed`, err.message);
    return { ok: false, error: err.message || 'Send failed' };
  }
}
