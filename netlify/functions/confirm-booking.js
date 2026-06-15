// netlify/functions/confirm-booking.js
//
// Called by the browser AFTER stripe.confirmCardPayment() succeeds.
// Writes the confirmed booking to Supabase session_bookings table.
//
// HARDENING: the only thing the browser is trusted for is the PaymentIntent id.
// Everything else (session, member, amount) is derived/verified server-side:
//   • the PaymentIntent must have actually succeeded
//   • its metadata.session_id must match the session being booked
//   • the amount charged must equal a legitimate price for that session
//   • the booker email comes from the PaymentIntent metadata, not the client
//   • a UNIQUE index on stripe_payment_intent_id stops one payment backing
//     multiple bookings; the write is done in an atomic, capacity-safe RPC.

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { supabaseAdmin } = require('./_supabase');
const { corsHeaders } = require('./_cors');

exports.handler = async (event) => {
  const CORS_HEADERS = corsHeaders(event);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { paymentIntentId, sessionId } = JSON.parse(event.body);
    if (!paymentIntentId || !sessionId) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Missing required fields' }) };
    }

    // ── Verify payment actually succeeded with Stripe ────────────────────
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return {
        statusCode: 402,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: `Payment not completed. Status: ${paymentIntent.status}` })
      };
    }

    // ── Bind the payment to THIS session (prevents reusing one payment for
    //    a different / more expensive session) ────────────────────────────
    const meta = paymentIntent.metadata || {};
    if (meta.session_id !== sessionId) {
      console.error(`PI/session mismatch: pi=${paymentIntentId} meta.session=${meta.session_id} req.session=${sessionId}`);
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Payment does not match this session.' }) };
    }

    // ── Verify the amount paid is a legitimate price for this session ─────
    const validAmounts = [Number(meta.member_price_cents), Number(meta.casual_price_cents)].filter(n => n > 0);
    if (validAmounts.length && !validAmounts.includes(paymentIntent.amount)) {
      console.error(`PI amount ${paymentIntent.amount} not a valid price (${validAmounts}) for session ${sessionId}`);
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Payment amount mismatch.' }) };
    }

    // Email/name come from the payment, NOT the client request body.
    const email    = meta.booker_email;
    const fullName = meta.booker_name || 'Guest';
    if (!email) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Payment is missing booker details.' }) };
    }

    // ── Get or create member record ──────────────────────────────────────
    let { data: member } = await supabaseAdmin
      .from('members')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (!member) {
      const { data: newMember, error: insErr } = await supabaseAdmin
        .from('members')
        .insert({
          full_name: fullName,
          email,
          tier: 'casual',
          status: 'active'   // casual = always "active" for session booking purposes
        })
        .select('id')
        .single();
      if (insErr) throw new Error(`member insert: ${insErr.message}`);
      member = newMember;
    }

    // ── Atomic, capacity-safe booking write (re-checks capacity under a
    //    row lock; UNIQUE index blocks payment-intent reuse) ──────────────
    const { data: bookingId, error: rpcErr } = await supabaseAdmin.rpc('confirm_session_booking', {
      p_session_id:     sessionId,
      p_member_id:      member.id,
      p_amount:         paymentIntent.amount / 100,
      p_payment_intent: paymentIntentId
    });

    if (rpcErr) {
      // UNIQUE violation → this payment was already used for a booking.
      if (rpcErr.code === '23505' || /payment_intent_unique/i.test(rpcErr.message)) {
        return { statusCode: 409, headers: CORS_HEADERS, body: JSON.stringify({ error: 'This payment has already been used for a booking.' }) };
      }
      if (/SESSION_FULL/.test(rpcErr.message)) {
        // Paid but no spot left — flag for manual refund/reconciliation.
        console.error(`SESSION_FULL after payment: pi=${paymentIntentId} session=${sessionId}`);
        return { statusCode: 409, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Session filled before your booking completed. Please contact us for a refund.', paymentIntentId }) };
      }
      console.error('confirm_session_booking RPC error:', rpcErr);
      return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Booking save failed. Payment was charged. Please contact us.', paymentIntentId }) };
    }

    // ── Fetch session details for confirmation email ─────────────────────
    const { data: session } = await supabaseAdmin
      .from('pool_sessions')
      .select('title, session_date, start_time, location')
      .eq('id', sessionId)
      .single();

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        bookingId,
        session: session ? {
          title: session.title,
          date: session.session_date,
          time: session.start_time,
          location: session.location
        } : null,
        amountCharged: paymentIntent.amount / 100
      })
    };

  } catch (err) {
    console.error('confirm-booking error:', err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Could not confirm booking.' })
    };
  }
};
