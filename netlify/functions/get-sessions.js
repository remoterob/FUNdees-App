// netlify/functions/get-sessions.js
//
// Returns upcoming sessions with live booking counts.
// Called by the frontend when the Sessions page loads.
// Uses the sessions_with_availability VIEW from Supabase.

const { supabaseAdmin } = require('./_supabase');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  try {
    const today = new Date().toISOString().split('T')[0];

    const { data: sessions, error } = await supabaseAdmin
      .from('sessions_with_availability')
      .select(`
        id,
        title,
        description,
        session_plan,
        session_date,
        start_time,
        end_time,
        location,
        capacity,
        booked_count,
        spots_remaining,
        member_price,
        casual_price,
        block_name,
        block_number,
        lead_name,
        status
      `)
      .eq('status', 'upcoming')
      .gte('session_date', today)
      .order('session_date', { ascending: true });

    if (error) throw error;

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ sessions })
    };

  } catch (err) {
    console.error('get-sessions error:', err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: err.message })
    };
  }
};
