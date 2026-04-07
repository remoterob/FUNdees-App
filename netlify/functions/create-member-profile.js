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
      qualifications,
      medical_confirmed,
      liability_confirmed,
      declarations_date
    } = JSON.parse(event.body);

    if (!auth_user_id || !email || !full_name) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing required fields' }) };
    }

    // Check if profile already exists for this auth user
    const { data: existing } = await supabaseAdmin
      .from('members')
      .select('id, status')
      .eq('auth_user_id', auth_user_id)
      .maybeSingle();

    if (existing) {
      // If previously deactivated, reactivate the account
      if (existing.status === 'cancelled') {
        await supabaseAdmin.from('members').update({
          status: 'pending',
          deactivated_at: null,
          full_name,
          phone:             phone || null,
          date_of_birth:     date_of_birth || null,
          emergency_contact: emergency_contact || null,
          medical_confirmed:    medical_confirmed || false,
          liability_confirmed:  liability_confirmed || false,
          declarations_date:    declarations_date || null,
        }).eq('id', existing.id);
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ id: existing.id, reactivated: true }) };
      }
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ id: existing.id, existed: true }) };
    }

    // Also check by email in case they signed up with a new auth account
    const { data: byEmail } = await supabaseAdmin
      .from('members')
      .select('id, status, auth_user_id')
      .eq('email', email)
      .maybeSingle();

    if (byEmail && byEmail.status === 'cancelled') {
      // Reactivate and link to new auth user
      await supabaseAdmin.from('members').update({
        auth_user_id,
        status: 'pending',
        deactivated_at: null,
        full_name,
        phone:             phone || null,
        date_of_birth:     date_of_birth || null,
        emergency_contact: emergency_contact || null,
        medical_confirmed:    medical_confirmed || false,
        liability_confirmed:  liability_confirmed || false,
        declarations_date:    declarations_date || null,
      }).eq('id', byEmail.id);
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ id: byEmail.id, reactivated: true }) };
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
        medical_confirmed:    medical_confirmed || false,
        liability_confirmed:  liability_confirmed || false,
        declarations_date:    declarations_date || null,
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
