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

      case 'invoice.payment_failed': {
        const customerId = stripeEvent.data.object.customer;
        const { data: member, error } = await supabaseAdmin.from('members').select('id').eq('stripe_customer_id', customerId).maybeSingle();
        if (error) throw new Error(`invoice failed lookup: ${error.message}`);
        if (member) {
          await supabaseAdmin.from('members').update({ status: 'expired' }).eq('id', member.id);
          console.log(`Invoice failed, expired member: ${member.id}`);
        }
        break;
      }

      default:
        console.log(`Unhandled: ${stripeEvent.type}`);
    }

    return { statusCode: 200, body: JSON.stringify({ received: true }) };

  } catch (err) {
    // Valid webhook, but our processing failed — log loudly, return 200 to stop Stripe retrying
    // (retrying could cause double-enrolments). Fix manually using the event ID in Stripe dashboard.
    console.error(`PROCESSING FAILED [${stripeEvent.type}] [${stripeEvent.id}]: ${err.message}`);
    return { statusCode: 200, body: JSON.stringify({ received: true, error: err.message }) };
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
