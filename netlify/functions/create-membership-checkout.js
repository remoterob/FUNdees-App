// netlify/functions/create-membership-checkout.js
//
// Called when a user clicks "Join Now" or "Get Started" on the membership page.
// Creates a Stripe Checkout Session (hosted payment page) and returns the URL.
// After payment, Stripe redirects to /success?session_id=xxx
// The stripe-webhook function then activates the membership in Supabase.

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { supabaseAdmin } = require('./_supabase');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const {
      tier,          // 'annual' | 'student' | 'casual'
      fullName,
      email,
      phone,
      emergencyContact,
      dateOfBirth
    } = JSON.parse(event.body);

    // ── Pick the right Stripe Price ID ──────────────────────────────────
    const priceMap = {
      annual:  process.env.STRIPE_ANNUAL_PRICE_ID,
      student: process.env.STRIPE_STUDENT_PRICE_ID,
    };

    if (!priceMap[tier]) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: `Unknown membership tier: ${tier}` })
      };
    }

    // ── Upsert member record in Supabase (status = 'pending' until paid) ──
    const { data: existingMember } = await supabaseAdmin
      .from('members')
      .select('id, stripe_customer_id')
      .eq('email', email)
      .maybeSingle();

    let stripeCustomerId = existingMember?.stripe_customer_id;
    let memberId = existingMember?.id;

    // Create Stripe Customer if they don't have one
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email,
        name: fullName,
        phone,
        metadata: { supabase_member_id: memberId || 'pending' }
      });
      stripeCustomerId = customer.id;
    }

    // Upsert member row
    const memberData = {
      full_name: fullName,
      email,
      phone: phone || null,
      emergency_contact: emergencyContact || null,
      date_of_birth: dateOfBirth || null,
      tier,
      status: 'pending',
      stripe_customer_id: stripeCustomerId
    };

    if (existingMember) {
      await supabaseAdmin
        .from('members')
        .update(memberData)
        .eq('id', existingMember.id);
    } else {
      const { data: newMember } = await supabaseAdmin
        .from('members')
        .insert(memberData)
        .select('id')
        .single();
      memberId = newMember.id;

      // Update Stripe customer metadata with real member ID
      await stripe.customers.update(stripeCustomerId, {
        metadata: { supabase_member_id: memberId }
      });
    }

    // ── Create Stripe Checkout Session ──────────────────────────────────
    const baseUrl = process.env.URL || 'http://localhost:8888';

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      line_items: [{ price: priceMap[tier], quantity: 1 }],
      success_url: `${baseUrl}/success.html?session_id={CHECKOUT_SESSION_ID}&type=membership`,
      cancel_url:  `${baseUrl}/?cancelled=true`,
      metadata: {
        supabase_member_id: memberId,
        tier
      },
      subscription_data: {
        metadata: {
          supabase_member_id: memberId,
          tier
        }
      }
    });

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ url: session.url })
    };

  } catch (err) {
    console.error('create-membership-checkout error:', err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: err.message })
    };
  }
};
