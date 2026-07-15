// netlify/functions/stripe-webhook.js
// Fixed: proper error handling, idempotency, signature failure returns 400 not 200

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { supabaseAdmin } = require('./_supabase');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  // ── Verify signature — return 400 on failure so Stripe retries ──────────
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('STRIPE_WEBHOOK_SECRET is not set');
    return { statusCode: 500, body: 'Webhook secret not configured' };
  }

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body, event.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature failed:', err.message);
    return { statusCode: 400, body: `Signature error: ${err.message}` };
  }

  console.log(`Stripe event: ${stripeEvent.type} [${stripeEvent.id}]`);

  try {
    switch (stripeEvent.type) {

      case 'checkout.session.completed': {
        const sess = stripeEvent.data.object;
        const type = sess.metadata?.type;
        if (type === 'membership') await handleMembership(sess);
        else if (type === 'enrolment') await handleEnrolment(sess);
        else if (type === 'sc_entry') await handleScEntry(sess);
        else console.warn(`Unknown checkout type: "${type}"`);
        break;
      }

      case 'customer.subscription.deleted': {
        const memberId = stripeEvent.data.object.metadata?.supabase_member_id;
        if (!memberId) { console.warn('subscription.deleted: no member id'); break; }
        const { error } = await supabaseAdmin.from('members').update({ status: 'expired' }).eq('id', memberId);
        if (error) throw new Error(`subscription expired update: ${error.message}`);
        console.log(`Membership expired: ${memberId}`);
        break;
      }

      case 'charge.refunded': {
        await handleChargeRefunded(stripeEvent.data.object);
        break;
      }

      case 'invoice.payment_failed': {
        // Memberships are one-time payments (mode: 'payment'), so a failed
        // *invoice* should NOT expire an active member — that only applies to
        // recurring subscriptions. Log for visibility and let
        // customer.subscription.deleted handle genuine subscription lapses.
        const inv = stripeEvent.data.object;
        if (inv.subscription) {
          const { data: member, error } = await supabaseAdmin.from('members').select('id').eq('stripe_customer_id', inv.customer).maybeSingle();
          if (error) throw new Error(`invoice failed lookup: ${error.message}`);
          if (member) {
            await supabaseAdmin.from('members').update({ status: 'expired' }).eq('id', member.id);
            console.log(`Subscription invoice failed, expired member: ${member.id}`);
          }
        } else {
          console.warn(`invoice.payment_failed for non-subscription invoice ${inv.id} — ignored`);
        }
        break;
      }

      default:
        console.log(`Unhandled: ${stripeEvent.type}`);
    }

    return { statusCode: 200, body: JSON.stringify({ received: true }) };

  } catch (err) {
    // Valid webhook, but our processing failed. Return 500 so Stripe RETRIES —
    // this is safe because every handler is idempotent (membership_payments has
    // a UNIQUE payment-intent, enrolments check status, status updates are
    // repeatable). Retrying recovers from transient DB blips instead of leaving
    // a customer "paid but not activated".
    console.error(`PROCESSING FAILED [${stripeEvent.type}] [${stripeEvent.id}]: ${err.message}`);
    return { statusCode: 500, body: JSON.stringify({ received: false, error: 'processing failed' }) };
  }
};

async function handleMembership(sess) {
  const memberId = sess.metadata?.supabase_member_id;
  if (!memberId) throw new Error('No supabase_member_id in membership metadata');

  // Idempotency — skip if already processed this payment
  const { data: dup } = await supabaseAdmin.from('membership_payments')
    .select('id').eq('stripe_payment_intent_id', sess.payment_intent).maybeSingle();
  if (dup) { console.log(`Membership already processed: ${sess.payment_intent}`); return; }

  const now = new Date();
  const end = new Date(now); end.setFullYear(end.getFullYear() + 1);

  const { error: mErr } = await supabaseAdmin.from('members').update({
    status: 'active', tier: 'annual',
    membership_start: now.toISOString().split('T')[0],
    membership_end:   end.toISOString().split('T')[0]
  }).eq('id', memberId);
  if (mErr) throw new Error(`Member update failed: ${mErr.message}`);

  const { error: pErr } = await supabaseAdmin.from('membership_payments').insert({
    member_id: memberId, amount: sess.amount_total / 100,
    currency: sess.currency.toUpperCase(), tier: 'annual', payment_status: 'paid',
    stripe_payment_intent_id: sess.payment_intent,
    period_start: now.toISOString().split('T')[0],
    period_end:   end.toISOString().split('T')[0],
    paid_at: new Date().toISOString()
  });
  if (pErr) throw new Error(`Payment record failed: ${pErr.message}`);

  console.log(`✓ Membership activated: ${memberId}`);
}

async function handleScEntry(sess) {
  const competitorId = sess.metadata?.competitor_id;
  const memberId     = sess.metadata?.member_id;
  if (!competitorId) throw new Error(`Missing sc_entry metadata: competitor=${competitorId}`);

  // Idempotency — skip if this competitor's entry is already marked paid
  const { data: c, error: fErr } = await supabaseAdmin.from('sc_competitors')
    .select('id, paid').eq('id', competitorId).maybeSingle();
  if (fErr) throw new Error(`sc_entry fetch: ${fErr.message}`);
  if (c?.paid) { console.log(`sc_entry already paid: ${competitorId}`); return; }

  const { error } = await supabaseAdmin.from('sc_competitors').update({
    paid: true,
    payment_ref: sess.payment_intent,
    stripe_payment_intent_id: sess.payment_intent
  }).eq('id', competitorId);
  if (error) throw new Error(`sc_entry update: ${error.message}`);

  console.log(`✓ Spear & Cook entry paid: competitor=${competitorId} member=${memberId}`);
}

async function handleChargeRefunded(charge) {
  // Syncs refunds issued outside the app (e.g. in the Stripe dashboard) onto
  // the matching enrolment. Refunds for memberships / Spear & Cook entries
  // simply won't match an enrolment row and are ignored.
  if (!charge.payment_intent) { console.warn('charge.refunded: no payment_intent — ignored'); return; }

  const { data: enr, error } = await supabaseAdmin.from('enrolments')
    .select('id, status, session_id').eq('stripe_payment_intent_id', charge.payment_intent).maybeSingle();
  if (error) throw new Error(`refund enrolment lookup: ${error.message}`);
  if (!enr) { console.log(`charge.refunded: no enrolment for ${charge.payment_intent} — ignored`); return; }

  // Idempotency — already synced (or refunded via the admin screen)
  if (enr.status === 'refunded') { console.log(`Refund already recorded: enrolment=${enr.id}`); return; }

  // Only flip status on a FULL refund; partial refunds keep the enrolment live
  if (!charge.refunded) {
    console.warn(`Partial refund on ${charge.payment_intent} (enrolment=${enr.id}) — status left as '${enr.status}'`);
    return;
  }

  const { error: uErr } = await supabaseAdmin.from('enrolments').update({
    status: 'refunded',
    stripe_refund_id: charge.refunds?.data?.[0]?.id || null,
    refunded_at: new Date().toISOString()
  }).eq('id', enr.id);
  if (uErr) throw new Error(`refund enrolment update: ${uErr.message}`);

  // A freed spot may reopen a full session
  const { data: s } = await supabaseAdmin.from('sessions_with_counts')
    .select('id, status, spots_remaining').eq('id', enr.session_id).maybeSingle();
  if (s && s.status === 'full' && s.spots_remaining > 0)
    await supabaseAdmin.from('sessions').update({ status: 'open' }).eq('id', s.id);

  console.log(`✓ Refund synced from Stripe: enrolment=${enr.id} pi=${charge.payment_intent}`);
}

async function handleEnrolment(sess) {
  const sessionId = sess.metadata?.session_id;
  const memberId  = sess.metadata?.member_id;
  if (!sessionId || !memberId) throw new Error(`Missing enrolment metadata: session=${sessionId} member=${memberId}`);

  // Fetch existing enrolment
  const { data: enr, error: fetchErr } = await supabaseAdmin.from('enrolments')
    .select('id, status').eq('session_id', sessionId).eq('member_id', memberId).maybeSingle();
  if (fetchErr) throw new Error(`Enrolment fetch: ${fetchErr.message}`);

  if (enr?.status === 'enrolled') {
    console.log(`Already enrolled: session=${sessionId} member=${memberId}`);
    return;
  }

  const payload = {
    status: 'enrolled', amount_paid: sess.amount_total / 100,
    stripe_payment_intent_id: sess.payment_intent,
    enrolled_at: new Date().toISOString()
  };

  if (!enr) {
    // No pending row — create it (edge case: browser never created the pending record)
    console.warn(`No pending enrolment found — inserting directly`);
    const { error } = await supabaseAdmin.from('enrolments').insert({ session_id: sessionId, member_id: memberId, ...payload });
    if (error) throw new Error(`Enrolment insert: ${error.message}`);
  } else {
    const { error } = await supabaseAdmin.from('enrolments').update(payload)
      .eq('session_id', sessionId).eq('member_id', memberId);
    if (error) throw new Error(`Enrolment update: ${error.message}`);
  }

  // Mark session full if needed
  const { data: counts } = await supabaseAdmin.from('sessions_with_counts')
    .select('spots_remaining').eq('id', sessionId).single();
  if (counts?.spots_remaining <= 0)
    await supabaseAdmin.from('sessions').update({ status: 'full' }).eq('id', sessionId);

  console.log(`✓ Enrolled: member=${memberId} session=${sessionId}`);
}
