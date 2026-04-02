// netlify/functions/create-enrolment-checkout.js
// Creates a Stripe Checkout session for a training session enrolment.
// On success, webhook marks the enrolment as enrolled.

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { supabaseAdmin } = require('./_supabase');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST')    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const { sessionId, memberId, email, fullName } = JSON.parse(event.body);
    if (!sessionId || !memberId || !email) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing fields' }) };

    // Fetch session
    const { data: session, error: sErr } = await supabaseAdmin
      .from('sessions_with_counts')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sErr || !session) return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Session not found' }) };
    if (session.status !== 'open')      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Session is not open for enrolment' }) };
    if (session.spots_remaining <= 0)   return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Session is full' }) };

    // Check not already enrolled
    const { data: existing } = await supabaseAdmin
      .from('enrolments')
      .select('id, status')
      .eq('session_id', sessionId)
      .eq('member_id', memberId)
      .maybeSingle();

    if (existing?.status === 'enrolled') return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Already enrolled in this session' }) };

    // Get or create Stripe customer
    const { data: member } = await supabaseAdmin
      .from('members')
      .select('stripe_customer_id')
      .eq('id', memberId)
      .single();

    let customerId = member?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({ email, name: fullName, metadata: { supabase_member_id: memberId } });
      customerId = customer.id;
      await supabaseAdmin.from('members').update({ stripe_customer_id: customerId }).eq('id', memberId);
    }

    // Create pending enrolment record
    await supabaseAdmin
      .from('enrolments')
      .upsert({ session_id: sessionId, member_id: memberId, status: 'pending_payment' }, { onConflict: 'session_id,member_id' });

    const baseUrl = process.env.URL || 'https://fundees.netlify.app';
    const amountCents = Math.round(session.price * 100);

    const checkout = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'nzd',
          unit_amount: amountCents,
          product_data: {
            name: session.title,
            description: `${session.type === 'pool' ? 'Pool' : 'Depth'} session · ${session.date_start} to ${session.date_end}`
          }
        },
        quantity: 1
      }],
      success_url: `${baseUrl}/sessions.html?enrolled=success`,
      cancel_url:  `${baseUrl}/sessions.html?enrolled=cancelled`,
      metadata: {
        type:       'enrolment',
        session_id: sessionId,
        member_id:  memberId
      }
    });

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ url: checkout.url }) };

  } catch (err) {
    console.error('create-enrolment-checkout error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
