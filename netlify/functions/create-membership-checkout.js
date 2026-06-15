// netlify/functions/create-membership-checkout.js
// One-time payment (not subscription) for annual membership.

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { supabaseAdmin } = require('./_supabase');
const { corsHeaders } = require('./_cors');
const { authenticate } = require('./_auth');

exports.handler = async (event) => {
  const CORS = corsHeaders(event);

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    // ── Caller must be authenticated; identity comes from the token ──────
    const { user, member: authMember, error: authError, statusCode } = await authenticate(event);
    if (authError) return { statusCode, headers: CORS, body: JSON.stringify({ error: authError }) };

    const body = JSON.parse(event.body || '{}');
    const email = authMember?.email || user.email;
    const fullName = body.fullName || user.user_metadata?.full_name || email;
    const phone = body.phone || '';

    // Get member record (by verified identity)
    const member = authMember
      ? { id: authMember.id, stripe_customer_id: authMember.stripe_customer_id }
      : (await supabaseAdmin.from('members').select('id, stripe_customer_id').eq('email', email).maybeSingle()).data;

    // Get or create Stripe customer
    let customerId = member?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email, name: fullName, phone,
        metadata: { supabase_member_id: member?.id || '' }
      });
      customerId = customer.id;
      if (member?.id) {
        await supabaseAdmin.from('members').update({ stripe_customer_id: customerId }).eq('id', member.id);
      }
    }

    const baseUrl = process.env.URL || 'https://fundees.netlify.app';

    // One-time payment — price must be set to one-time in Stripe dashboard
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      line_items: [{ price: process.env.STRIPE_ANNUAL_PRICE_ID, quantity: 1 }],
      success_url: `${baseUrl}/portal.html?payment=success`,
      cancel_url:  `${baseUrl}/portal.html?payment=cancelled`,
      metadata: {
        supabase_member_id: member?.id || '',
        type: 'membership'
      }
    });

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ url: session.url }) };

  } catch (err) {
    console.error('checkout error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Could not start checkout. Please try again.' }) };
  }
};
