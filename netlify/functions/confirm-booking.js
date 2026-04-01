// netlify/functions/confirm-booking.js
//
// Called by the browser AFTER stripe.confirmCardPayment() succeeds.
// Writes the confirmed booking to Supabase session_bookings table.
// Also upserts the member record if they're a guest (casual booker).

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { supabaseAdmin } = require('./_supabase');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const {
      paymentIntentId,   // from stripe.confirmCardPayment result
      sessionId,
      email,
      fullName
    } = JSON.parse(event.body);

    // ── Verify payment actually succeeded with Stripe ────────────────────
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return {
        statusCode: 402,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: `Payment not completed. Status: ${paymentIntent.status}` })
      };
    }

    // ── Get or create member record ──────────────────────────────────────
    let { data: member } = await supabaseAdmin
      .from('members')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (!member) {
      const { data: newMember } = await supabaseAdmin
        .from('members')
        .insert({
          full_name: fullName,
          email,
          tier: 'casual',
          status: 'active'   // casual = always "active" for session booking purposes
        })
        .select('id')
        .single();
      member = newMember;
    }

    // ── Write booking to Supabase ────────────────────────────────────────
    const { data: booking, error: bookingErr } = await supabaseAdmin
      .from('session_bookings')
      .upsert(
        {
          session_id: sessionId,
          member_id: member.id,
          status: 'confirmed',
          payment_status: 'paid',
          amount_charged: paymentIntent.amount / 100,
          stripe_payment_intent_id: paymentIntentId,
          paid_at: new Date().toISOString()
        },
        { onConflict: 'session_id,member_id' }
      )
      .select()
      .single();

    if (bookingErr) {
      console.error('Supabase booking error:', bookingErr);
      // Payment succeeded but DB write failed — log for manual reconciliation
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: 'Booking save failed. Payment was charged. Please contact us.',
          paymentIntentId
        })
      };
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
        bookingId: booking.id,
        session: {
          title: session.title,
          date: session.session_date,
          time: session.start_time,
          location: session.location
        },
        amountCharged: booking.amount_charged
      })
    };

  } catch (err) {
    console.error('confirm-booking error:', err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: err.message })
    };
  }
};
