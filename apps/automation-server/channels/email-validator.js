/**
 * Layered email validation — 3-step pipeline:
 *   1. MailChecker  → instant disposable-email block (55K+ domains)
 *   2. deep-email-validator → syntax + typo suggestion + MX + SMTP handshake
 *   3. Custom checks → role-based detection + free provider flag
 */
import { validate } from 'deep-email-validator';
import MailChecker from 'mailchecker';

const ROLE_PREFIXES = [
  'admin', 'info', 'support', 'help', 'contact', 'sales', 'billing',
  'abuse', 'postmaster', 'webmaster', 'hostmaster', 'noreply', 'no-reply',
  'mailer-daemon', 'office', 'team', 'hello', 'feedback', 'security',
];

const FREE_PROVIDERS = new Set([
  'gmail.com', 'yahoo.com', 'yahoo.co.in', 'hotmail.com', 'outlook.com',
  'live.com', 'aol.com', 'icloud.com', 'me.com', 'mail.com', 'protonmail.com',
  'proton.me', 'zoho.com', 'yandex.com', 'gmx.com', 'gmx.net', 'tutanota.com',
  'tuta.com', 'fastmail.com', 'hey.com',
]);

/**
 * Validate a single email through all layers.
 * @returns {{ email, valid, score, checks, suggestion? }}
 */
export async function validateEmail(email) {
  const result = {
    email,
    valid: false,
    score: 0,
    reason: '',
    checks: {
      syntax: false,
      disposable: false,
      mx: false,
      smtp: false,
      roleBased: false,
      freeProvider: false,
    },
    suggestion: null,
  };

  if (!email || typeof email !== 'string') {
    result.reason = 'Invalid input';
    return result;
  }

  const normalized = email.trim().toLowerCase();
  const [local, domain] = normalized.split('@');
  if (!local || !domain) {
    result.reason = 'Invalid email format';
    return result;
  }

  // ── Layer 1: MailChecker — disposable email detection ───────────────────────
  const isNotDisposable = MailChecker.isValid(normalized);
  result.checks.disposable = isNotDisposable;
  if (!isNotDisposable) {
    result.reason = 'Disposable/temporary email address';
    return result;
  }

  // ── Layer 2: deep-email-validator — syntax + typo + MX + SMTP ──────────────
  try {
    const deepResult = await validate({
      email: normalized,
      sender: normalized,
      validateRegex: true,
      validateMx: true,
      validateTypo: true,
      validateDisposable: true,
      validateSMTP: true,
    });

    result.checks.syntax = deepResult.validators?.regex?.valid ?? false;
    result.checks.mx = deepResult.validators?.mx?.valid ?? false;
    result.checks.smtp = deepResult.validators?.smtp?.valid ?? false;

    if (deepResult.validators?.typo?.reason) {
      result.suggestion = deepResult.validators.typo.reason;
    }

    if (!result.checks.syntax) {
      result.reason = 'Invalid email syntax';
      return result;
    }

    if (!result.checks.mx) {
      result.reason = 'Domain has no mail server (MX record not found)';
      return result;
    }
  } catch (err) {
    result.reason = `Validation error: ${err.message}`;
    result.checks.syntax = true; // assume syntax is fine if deep-validator crashed
    return result;
  }

  // ── Layer 3: Custom checks — role-based + free provider ────────────────────
  const isRoleBased = ROLE_PREFIXES.some((p) => local === p || local.startsWith(p + '.'));
  result.checks.roleBased = isRoleBased;
  result.checks.freeProvider = FREE_PROVIDERS.has(domain);

  // ── Scoring ────────────────────────────────────────────────────────────────
  // Each check contributes to a 0-100 score
  let score = 0;
  if (result.checks.syntax)     score += 15;
  if (result.checks.disposable) score += 20;
  if (result.checks.mx)         score += 25;
  if (result.checks.smtp)       score += 30;
  if (!result.checks.roleBased) score += 5;
  if (!result.checks.freeProvider) score += 5;

  result.score = score;
  result.valid = score >= 60; // syntax + disposable + MX minimum
  result.reason = result.valid
    ? (result.checks.smtp ? 'Mailbox verified' : 'Domain valid, mailbox unverified')
    : 'Email verification failed';

  return result;
}

/**
 * Validate multiple emails concurrently (max 10 at a time).
 */
export async function validateEmails(emails) {
  const batch = emails.slice(0, 50); // cap at 50 per request
  const concurrency = 10;
  const results = [];

  for (let i = 0; i < batch.length; i += concurrency) {
    const chunk = batch.slice(i, i + concurrency);
    const chunkResults = await Promise.all(chunk.map((e) => validateEmail(e)));
    results.push(...chunkResults);
  }

  return results;
}
