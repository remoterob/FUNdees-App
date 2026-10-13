// netlify/functions/create-merch-checkout.js
//
// Creates a Stripe Checkout session for a merch order (currently: the
// FUNdees Poncho Towel). Unlike sc-entry-checkout, auth is OPTIONAL —
// guests can buy merch too. If a valid Bearer token is sent, the member's
// name/email/phone are used to fill in anything the browser didn't supply
// and the order is linked to member_id. The price is always computed
// server-side (never trust the client for amount).

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { supabaseAdmin } = require('./_supabase');
const { corsHeaders, resolveBaseUrl } = require('./_cors');

const PRODUCT_NAME = 'FUNdees Poncho Towel';
const UNIT_PRICE   = 55.00; // NZD

exports.handler = async (event) => {
  const CORS = corsHeaders(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    let body;
    try { body = JSON.parse(event.body || '{}'); }
    catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid request body' }) }; }

    // Optional auth — a member gets their order linked + fields defaulted,
    // a guest just supplies their own details.
    let member = null;
    let user = null;
    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice('Bearer '.length);
      const { data } = await supabaseAdmin.auth.getUser(token);
      user = data?.user || null;
      if (user) {
        const { data: m } = await supabaseAdmin
          .from('members')
          .select('id, full_name, email, phone, stripe_customer_id')
          .eq('auth_user_id', user.id)
          .maybeSingle();
        member = m || null;
      }
    }

    const fullName = (body.fullName || member?.full_name || '').trim();
    const email    = (body.email || member?.email || user?.email || '').trim();
    const phone    = (body.phone || member?.phone || '').trim();
    const address  = (body.address || '').trim();

    if (!fullName || !email) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Name and email are required.' }) };
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Enter a valid email address.' }) };
    }

    let quantity = parseInt(body.quantity, 10);
    if (!Number.isInteger(quantity) || quantity < 1) quantity = 1;
    if (quantity > 10) quantity = 10;

    const amount = Math.round(UNIT_PRICE * quantity * 100) / 100;

    // Pending order row first, so the webhook always has somewhere to write.
    const { data: order, error: orderErr } = await supabaseAdmin.from('merch_orders').insert({
      member_id: member?.id || null,
      full_name: fullName,
      email,
      phone: phone || null,
      delivery_address: address || null,
      product_name: PRODUCT_NAME,
      quantity,
      unit_price: UNIT_PRICE,
      currency: 'NZD',
      status: 'pending'
    }).select('id').single();
    if (orderErr) throw new Error(`Order insert failed: ${orderErr.message}`);

    // Reuse/create a Stripe customer for members; guests just use customer_email.
    let customerId = member?.stripe_customer_id || null;
    if (member && !customerId) {
      const customer = await stripe.customers.create({ email, name: fullName, metadata: { supabase_member_id: member.id } });
      customerId = customer.id;
      await supabaseAdmin.from('members').update({ stripe_customer_id: customerId }).eq('id', member.id);
    }

    const baseUrl = resolveBaseUrl(event);
    const checkout = await stripe.checkout.sessions.create({
      ...(customerId ? { customer: customerId } : { customer_email: email }),
      mode: 'payment',
      phone_number_collection: { enabled: true },
      line_items: [{
        price_data: {
          currency: 'nzd',
          unit_amount: Math.round(UNIT_PRICE * 100),
          product_data: { name: PRODUCT_NAME, description: 'One size fits all — FUNdees merch' }
        },
        quantity
      }],
      success_url: `${baseUrl}/merch.html?order=success`,
      cancel_url:  `${baseUrl}/merch.html?order=cancelled`,
      metadata: {
        type: 'merch',
        order_id: order.id,
        member_id: member?.id || ''
      }
    });

    await supabaseAdmin.from('merch_orders').update({ stripe_checkout_session_id: checkout.id }).eq('id', order.id);

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ url: checkout.url, amount }) };

  } catch (err) {
    console.error('create-merch-checkout error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Could not start checkout. Please try again.' }) };
  }
};
