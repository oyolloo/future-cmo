/**
 * SMS channel — BulkSMSBD HTTP sender (reusable).
 * Reads API key from env (same as Next.js).
 */

export async function sendSms(to, message) {
  const apiKey = process.env.BULKSMSBD_API_KEY;
  const senderId = process.env.BULKSMSBD_SENDER_ID || '';
  if (!apiKey) return { ok: false, error: 'BULKSMSBD_API_KEY not configured' };

  try {
    const res = await fetch('http://bulksmsbd.net/api/smsapi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey, senderid: senderId, number: to, message }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: data.response_code === 202 || res.ok, messageId: data.request_id || '', data };
  } catch (err) {
    return { ok: false, error: err.message || 'SMS send failed' };
  }
}
