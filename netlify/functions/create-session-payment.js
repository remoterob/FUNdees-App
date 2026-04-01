// netlify/functions/create-session-payment.js
//
// Called when a member clicks "Confirm & Pay" on the session booking modal.
// Creates a Stripe Payment Intent and returns the client_secret to the browser.
// The browser then calls stripe.confirmCardPayment(clientSecret, cardElement).
// On success, the browser calls confirm-booking to write the booking to Supabase.

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
      sessionId,    // UUID of the pool_session
      email,
      fullName
    } = JSON.parse(event.body);

    // ── Fetch session to get price and check capacity ────────────────────
    const { data: poolSession, error: sessionErr } = await supabaseAdmin
      .from('sessions_with_availability')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionErr || !poolSession) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Session not found' })
      };
    }

    if (poolSession.spots_remaining <= 0) {
      return {
        statusCode: 409,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Session is fully booked' })
      };
    }

    // ── Determine price based on membership ─────────────────────────────
    const { data: member } = await supabaseAdmin
      .from('members')
      .select('id, status, stripe_customer_id')
      .eq('email', email)
      .maybeSingle();

    const isActiveMember = member?.status === 'active';
    const amountCents = isActiveMember
      ? Math.round(poolSession.member_price * 100)
      : Math.round(poolSession.casual_price * 100);

    // ── Get or create Stripe customer ────────────────────────────────────
    let stripeCustomerId = member?.stripe_customer_id;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email,
        name: fullName,
        metadata: { type: 'casual_session_booker' }
      });
      stripeCustomerId = customer.id;
    }

    // ── Create Payment Intent ────────────────────────────────────────────
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'nzd',
      customer: stripeCustomerId,
      description: `Pool session: ${poolSession.title} on ${poolSession.session_date}`,
      metadata: {
        session_id: sessionId,
        booker_email: email,
        booker_name: fullName,
        supabase_member_id: member?.id || 'guest',
        is_member: String(isActiveMember)
      }
    });

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        amountCents,
        isActiveMember,
        sessionTitle: poolSession.title,
        sessionDate: poolSession.session_date
      })
    };

  } catch (err) {
    console.error('create-session-payment error:', err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: err.message })
    };
  }
};
