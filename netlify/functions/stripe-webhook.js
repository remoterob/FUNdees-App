// netlify/functions/stripe-webhook.js
//
// Stripe sends POST requests here for every payment event.
// This is the authoritative way to update Supabase — not the browser.
// Register this URL in your Stripe Dashboard → Webhooks:
//   https://YOUR-SITE.netlify.app/.netlify/functions/stripe-webhook
//
// Events handled:
//   checkout.session.completed      → activate membership after checkout
//   customer.subscription.deleted  → expire membership
//   payment_intent.succeeded        → belt-and-suspenders session booking confirm
//   invoice.payment_failed          → mark membership expired

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { supabaseAdmin } = require('./_supabase');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // ── Verify webhook signature ─────────────────────────────────────────
  const sig = event.headers['stripe-signature'];
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  console.log(`Processing Stripe event: ${stripeEvent.type}`);

  try {
    switch (stripeEvent.type) {

      case 'checkout.session.completed': {
        const session = stripeEvent.data.object;
        const type = session.metadata?.type;

        // ── Membership payment ─────────────────────────────────────────────
        if (type === 'membership') {
          const memberId = session.metadata?.supabase_member_id;
          if (!memberId) { console.error('No member id in metadata'); break; }

          const now = new Date();
          const periodEnd = new Date(now);
          periodEnd.setFullYear(periodEnd.getFullYear() + 1);

          await supabaseAdmin.from('members').update({
            status: 'active',
            tier: 'annual',
            membership_start: now.toISOString().split('T')[0],
            membership_end:   periodEnd.toISOString().split('T')[0]
          }).eq('id', memberId);

          await supabaseAdmin.from('membership_payments').insert({
            member_id: memberId,
            amount: session.amount_total / 100,
            currency: session.currency.toUpperCase(),
            tier: 'annual',
            payment_status: 'paid',
            stripe_payment_intent_id: session.payment_intent,
            period_start: now.toISOString().split('T')[0],
            period_end:   periodEnd.toISOString().split('T')[0],
            paid_at: new Date().toISOString()
          });

          console.log(`Membership activated for ${memberId}`);
        }

        // ── Session enrolment payment ──────────────────────────────────────
        if (type === 'enrolment') {
          const sessionId = session.metadata?.session_id;
          const memberId  = session.metadata?.member_id;
          if (!sessionId || !memberId) { console.error('Missing enrolment metadata'); break; }

          await supabaseAdmin.from('enrolments').update({
            status:                   'enrolled',
            amount_paid:              session.amount_total / 100,
            stripe_payment_intent_id: session.payment_intent,
            enrolled_at:              new Date().toISOString()
          }).eq('session_id', sessionId).eq('member_id', memberId);

          // Mark session full if no spots left
          const { data: counts } = await supabaseAdmin
            .from('sessions_with_counts').select('spots_remaining').eq('id', sessionId).single();
          if (counts?.spots_remaining <= 0) {
            await supabaseAdmin.from('sessions').update({ status: 'full' }).eq('id', sessionId);
          }

          console.log(`Enrolment confirmed: member ${memberId} in session ${sessionId}`);
        }

        break;
      }

      // ── Subscription cancelled / lapsed ───────────────────────────────
      case 'customer.subscription.deleted': {
        const subscription = stripeEvent.data.object;
        const memberId = subscription.metadata?.supabase_member_id;

        if (!memberId) break;

        await supabaseAdmin
          .from('members')
          .update({ status: 'expired' })
          .eq('id', memberId);

        console.log(`Membership expired for member ${memberId}`);
        break;
      }

      // ── Invoice payment failed (renewal failure) ───────────────────────
      case 'invoice.payment_failed': {
        const invoice = stripeEvent.data.object;
        const customerId = invoice.customer;

        const { data: member } = await supabaseAdmin
          .from('members')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle();

        if (member) {
          await supabaseAdmin
            .from('members')
            .update({ status: 'expired' })
            .eq('id', member.id);

          console.log(`Membership payment failed, expired member ${member.id}`);
        }
        break;
      }

      // ── Session payment succeeded (belt-and-suspenders) ───────────────
      // The browser also calls confirm-booking after payment, but this
      // catches any cases where the browser dropped the connection.
      case 'payment_intent.succeeded': {
        const pi = stripeEvent.data.object;
        const sessionId = pi.metadata?.session_id;

        // Only handle session bookings (membership goes through checkout.session.completed)
        if (!sessionId) break;

        const email = pi.metadata?.booker_email;
        const fullName = pi.metadata?.booker_name;
        const memberId = pi.metadata?.supabase_member_id;

        // Find or create member
        let finalMemberId = memberId !== 'guest' ? memberId : null;

        if (!finalMemberId && email) {
          const { data: existing } = await supabaseAdmin
            .from('members')
            .select('id')
            .eq('email', email)
            .maybeSingle();

          if (existing) {
            finalMemberId = existing.id;
          } else {
            const { data: newMember } = await supabaseAdmin
              .from('members')
              .insert({
                full_name: fullName || email,
                email,
                tier: 'casual',
                status: 'active'
              })
              .select('id')
              .single();
            finalMemberId = newMember?.id;
          }
        }

        if (!finalMemberId) break;

        // Upsert booking (idempotent — safe to run twice)
        await supabaseAdmin
          .from('session_bookings')
          .upsert(
            {
              session_id: sessionId,
              member_id: finalMemberId,
              status: 'confirmed',
              payment_status: 'paid',
              amount_charged: pi.amount / 100,
              stripe_payment_intent_id: pi.id,
              paid_at: new Date().toISOString()
            },
            { onConflict: 'session_id,member_id' }
          );

        console.log(`Session booking confirmed via webhook for ${email}`);
        break;
      }

      default:
        console.log(`Unhandled event type: ${stripeEvent.type}`);
    }

    return { statusCode: 200, body: JSON.stringify({ received: true }) };

  } catch (err) {
    console.error('Webhook handler error:', err);
    // Return 200 anyway so Stripe doesn't keep retrying for our internal errors
    return {
      statusCode: 200,
      body: JSON.stringify({ received: true, internalError: err.message })
    };
  }
};
