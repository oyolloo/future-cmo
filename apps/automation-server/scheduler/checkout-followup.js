/**
 * Incomplete Checkout follow-up scheduler.
 * Polls incomplete_checkouts where follow_up_at <= now() and follow_up_status = 'none'.
 * Sends SMS or email follow-up, then updates status.
 */
import { query } from '../db.js';
import { sendSms } from '../channels/sms.js';
import { sendEmail } from '../channels/email.js';

const INTERVAL = 60_000;

async function processDueFollowups() {
  try {
    const rows = await query(
      `UPDATE incomplete_checkouts SET follow_up_status='processing', updated_at=now()
       WHERE id IN (
         SELECT id FROM incomplete_checkouts
         WHERE follow_up_at <= now() AND follow_up_status='none' AND status='abandoned'
         LIMIT 20 FOR UPDATE SKIP LOCKED
       ) RETURNING *`);

    for (const checkout of rows) {
      try {
        // Try SMS first (if phone exists), then email.
        if (checkout.phone) {
          const msg = `Hi! You left items in your cart. Complete your order now!`;
          await sendSms(checkout.phone, msg);
          await query("UPDATE incomplete_checkouts SET follow_up_status='sms', follow_up_note='Auto SMS sent' WHERE id=$1", [checkout.id]);
        } else if (checkout.email) {
          await sendEmail(String(checkout.workspace_id), {
            to: checkout.email,
            subject: 'You left items in your cart!',
            body: '<p>Hi! You left items in your cart. Complete your order now!</p>',
          });
          await query("UPDATE incomplete_checkouts SET follow_up_status='email', follow_up_note='Auto email sent' WHERE id=$1", [checkout.id]);
        } else {
          await query("UPDATE incomplete_checkouts SET follow_up_status='skipped', follow_up_note='No contact info' WHERE id=$1", [checkout.id]);
        }
      } catch (err) {
        await query("UPDATE incomplete_checkouts SET follow_up_status='failed', follow_up_note=$2 WHERE id=$1",
          [checkout.id, err.message || 'Follow-up failed']);
      }
    }
  } catch (err) {
    // Table doesn't exist yet = addon not set up. Silent — don't spam logs.
    if (!err.message?.includes('does not exist')) {
      console.error('[checkout-followup] error', err.message);
    }
  }
}

export function startCheckoutFollowup() {
  console.log('[checkout-followup] started (60s interval)');
  setInterval(processDueFollowups, INTERVAL);
}
