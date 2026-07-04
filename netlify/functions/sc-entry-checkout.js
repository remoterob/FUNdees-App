// netlify/functions/sc-entry-checkout.js
//
// Spear & Cook — creates a Stripe Checkout session for the competitor
// ENTRY FEE. Two gates enforced server-side (never trust the client):
//   1. Caller must have an ACTIVE FUNdees membership.
//   2. Caller must already have a registration (sc_competitors) row.
// On success the webhook (type: 'sc_entry') sets sc_competitors.paid = true.

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { supabaseAdmin } = require('./_supabase');
const { corsHeaders } = require('./_cors');
const { authenticate } = require('./_auth');

exports.handler = async (event) => {
  const CORS = corsHeaders(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const { user, member: authMember, error: authError, statusCode } = await authenticate(event);
    if (authError) return { statusCode, headers: CORS, body: JSON.stringify({ error: authError }) };
    if (!authMember) return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'No member profile' }) };

    // Gate 1 — active membership required
    if (authMember.status !== 'active') {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({
        error: 'membership_required',
        message: 'An active FUNdees membership is required to enter Spear & Cook.'
      }) };
    }

    // Active competition + fee
    const { data: comp, error: compErr } = await supabaseAdmin
      .from('sc_competitions')
      .select('id, name, entry_fee, status')
      .eq('status', 'active')
      .maybeSingle();
    if (compErr) throw compErr;
    if (!comp) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'No competition is open right now.' }) };

    const fee = Number(comp.entry_fee) || 0;
    if (fee <= 0) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'no_fee', message: 'This competition has no entry fee.' }) };

    // Gate 2 — must be registered first
    const { data: competitor } = await supabaseAdmin
      .from('sc_competitors')
      .select('id, paid')
      .eq('competition_id', comp.id)
      .eq('member_id', authMember.id)
      .maybeSingle();
    if (!competitor) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'not_registered', message: 'Save your registration before paying the entry fee.' }) };
    if (competitor.paid) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'already_paid', message: 'Your entry is already paid.' }) };

    // Stripe customer
    const email = authMember.email || user.email;
    const fullName = user.user_metadata?.full_name || email;
    let customerId = authMember.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({ email, name: fullName, metadata: { supabase_member_id: authMember.id } });
      customerId = customer.id;
      await supabaseAdmin.from('members').update({ stripe_customer_id: customerId }).eq('id', authMember.id);
    }

    const baseUrl = process.env.URL || 'https://fundees.netlify.app';
    const checkout = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'nzd',
          unit_amount: Math.round(fee * 100),
          product_data: { name: `${comp.name} — Entry`, description: 'Spear & Cook competitor entry fee' }
        },
        quantity: 1
      }],
      success_url: `${baseUrl}/spear-and-cook.html?entry=success`,
      cancel_url:  `${baseUrl}/spear-and-cook.html?entry=cancelled`,
      metadata: {
        type: 'sc_entry',
        competition_id: comp.id,
        member_id: authMember.id,
        competitor_id: competitor.id
      }
    });

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ url: checkout.url }) };

  } catch (err) {
    console.error('sc-entry-checkout error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Could not start checkout. Please try again.' }) };
  }
};
