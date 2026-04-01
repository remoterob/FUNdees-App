// netlify/functions/create-member-profile.js
//
// Called after Supabase signUp() succeeds in the browser.
// Uses the SERVICE ROLE key to bypass RLS and insert the member row.
// The browser never has the service role key.

const { supabaseAdmin } = require('./_supabase');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const {
      auth_user_id,
      full_name,
      email,
      phone,
      date_of_birth,
      emergency_contact,
      qualifications
    } = JSON.parse(event.body);

    if (!auth_user_id || !email || !full_name) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing required fields' }) };
    }

    // Check if profile already exists (idempotent)
    const { data: existing } = await supabaseAdmin
      .from('members')
      .select('id')
      .eq('auth_user_id', auth_user_id)
      .maybeSingle();

    if (existing) {
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ id: existing.id, existed: true }) };
    }

    const { data, error } = await supabaseAdmin
      .from('members')
      .insert({
        auth_user_id,
        full_name,
        email,
        phone:             phone || null,
        date_of_birth:     date_of_birth || null,
        emergency_contact: emergency_contact || null,
        qualifications:    qualifications?.length > 0 ? qualifications : null,
        tier:              'casual',
        status:            'pending'
      })
      .select('id')
      .single();

    if (error) throw error;

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ id: data.id }) };

  } catch (err) {
    console.error('create-member-profile error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
