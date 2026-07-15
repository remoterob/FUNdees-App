// netlify/functions/admin-manage-enrolment.js
// Admin-only management of training-session enrolments:
//   action: 'set_status' — change an enrolment's status (pending_payment / enrolled / cancelled)
//   action: 'refund'     — refund the Stripe payment and mark the enrolment refunded
// After either action the parent session is flipped between 'full' and 'open'
// to match the recalculated enrolled count.

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { supabaseAdmin } = require('./_supabase');
const { corsHeaders } = require('./_cors');
const { authenticate } = require('./_auth');

const SETTABLE_STATUSES = ['pending_payment', 'enrolled', 'cancelled'];

exports.handler = async (event) => {
  const CORS = corsHeaders(event);

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST')    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };

  // ── Admin-only ──────────────────────────────────────────────────────────
  const { member, error: authError, statusCode } = await authenticate(event);
  if (authError) return { statusCode, headers: CORS, body: JSON.stringify({ error: authError }) };
  if (!member?.is_admin) return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Admin access required' }) };

  try {
    const { enrolmentId, action, status } = JSON.parse(event.body || '{}');
    if (!enrolmentId || !action) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing fields' }) };

    const { data: enr, error: fetchErr } = await supabaseAdmin
      .from('enrolments')
      .select('id, session_id, member_id, status, amount_paid, stripe_payment_intent_id')
      .eq('id', enrolmentId)
      .maybeSingle();
    if (fetchErr) throw new Error(`Enrolment fetch: ${fetchErr.message}`);
    if (!enr) return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Enrolment not found' }) };

    if (action === 'set_status') {
      if (!SETTABLE_STATUSES.includes(status)) {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid status' }) };
      }
      if (enr.status === 'refunded') {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Enrolment has been refunded — status is locked' }) };
      }

      const payload = { status };
      if (status === 'enrolled') payload.enrolled_at = new Date().toISOString();

      const { error: uErr } = await supabaseAdmin.from('enrolments').update(payload).eq('id', enrolmentId);
      if (uErr) throw new Error(`Status update: ${uErr.message}`);

      await syncSessionStatus(enr.session_id);
      console.log(`✓ Admin ${member.id} set enrolment ${enrolmentId}: ${enr.status} → ${status}`);
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, status }) };
    }

    if (action === 'refund') {
      if (enr.status === 'refunded') {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Already refunded' }) };
      }
      if (!enr.stripe_payment_intent_id) {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'No Stripe payment recorded for this enrolment' }) };
      }

      let refund;
      try {
        refund = await stripe.refunds.create({
          payment_intent: enr.stripe_payment_intent_id,
          metadata: { type: 'enrolment', enrolment_id: enr.id, session_id: enr.session_id, member_id: enr.member_id }
        });
      } catch (stripeErr) {
        // The charge was already refunded in the Stripe dashboard — just sync our record
        if (stripeErr.code === 'charge_already_refunded') {
          console.warn(`Stripe reports charge already refunded for enrolment ${enrolmentId} — syncing status`);
        } else {
          console.error('Stripe refund failed:', stripeErr.message);
          return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: `Stripe refund failed: ${stripeErr.message}` }) };
        }
      }

      const { error: uErr } = await supabaseAdmin.from('enrolments').update({
        status: 'refunded',
        stripe_refund_id: refund?.id || null,
        refunded_at: new Date().toISOString()
      }).eq('id', enrolmentId);
      if (uErr) throw new Error(`Refund status update: ${uErr.message}`);

      await syncSessionStatus(enr.session_id);
      console.log(`✓ Admin ${member.id} refunded enrolment ${enrolmentId} (refund=${refund?.id || 'pre-existing'})`);
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({ ok: true, refundId: refund?.id || null, amount: refund ? refund.amount / 100 : null })
      };
    }

    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Unknown action' }) };

  } catch (err) {
    console.error('admin-manage-enrolment error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Something went wrong. Please try again.' }) };
  }
};

// Flip the session between 'full' and 'open' based on the live enrolled count.
// Only touches sessions currently in one of those two states so admin-set
// 'closed' / 'opening_soon' are never overridden.
async function syncSessionStatus(sessionId) {
  const { data: s, error } = await supabaseAdmin
    .from('sessions_with_counts')
    .select('status, spots_remaining')
    .eq('id', sessionId)
    .maybeSingle();
  if (error || !s) { console.warn(`syncSessionStatus: could not read session ${sessionId}`); return; }

  if (s.spots_remaining <= 0 && s.status === 'open') {
    await supabaseAdmin.from('sessions').update({ status: 'full' }).eq('id', sessionId);
  } else if (s.spots_remaining > 0 && s.status === 'full') {
    await supabaseAdmin.from('sessions').update({ status: 'open' }).eq('id', sessionId);
  }
}
