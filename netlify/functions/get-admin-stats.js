// netlify/functions/get-admin-stats.js
//
// Returns dashboard metrics for the admin panel.
// Requires a valid Supabase JWT belonging to a member with is_admin = true.

const { supabaseAdmin } = require('./_supabase');
const { corsHeaders } = require('./_cors');
const { authenticate } = require('./_auth');

exports.handler = async (event) => {
  const CORS_HEADERS = corsHeaders(event);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  // ── Admin-only ────────────────────────────────────────────────────────
  const { member, error: authError, statusCode } = await authenticate(event);
  if (authError) return { statusCode, headers: CORS_HEADERS, body: JSON.stringify({ error: authError }) };
  if (!member?.is_admin) {
    return { statusCode: 403, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Admin access required' }) };
  }

  try {
    const today = new Date().toISOString().split('T')[0];
    const firstOfMonth = today.slice(0, 7) + '-01';

    // Run queries in parallel
    const [
      { count: totalMembers },
      { count: activeMembers },
      { count: sessionsThisMonth },
      { data: recentMembers },
      { data: upcomingSessions },
      { data: revenueData }
    ] = await Promise.all([
      supabaseAdmin.from('members').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('members').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabaseAdmin.from('pool_sessions').select('*', { count: 'exact', head: true })
        .gte('session_date', firstOfMonth).eq('status', 'upcoming'),
      supabaseAdmin.from('members').select('id, full_name, email, tier, status, created_at')
        .order('created_at', { ascending: false }).limit(5),
      supabaseAdmin.from('sessions_with_availability')
        .select('id, title, session_date, start_time, capacity, booked_count, spots_remaining, lead_name')
        .eq('status', 'upcoming').gte('session_date', today)
        .order('session_date').limit(5),
      supabaseAdmin.from('session_bookings')
        .select('amount_charged')
        .eq('payment_status', 'paid')
        .gte('paid_at', firstOfMonth)
    ]);

    const revenueMTD = (revenueData || []).reduce((sum, r) => sum + (r.amount_charged || 0), 0);
    const avgFillRate = upcomingSessions?.length
      ? Math.round(
          upcomingSessions.reduce((sum, s) => sum + (s.booked_count / s.capacity), 0)
          / upcomingSessions.length * 100
        )
      : 0;

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        stats: {
          totalMembers,
          activeMembers,
          sessionsThisMonth,
          revenueMTD: revenueMTD.toFixed(2),
          avgFillRate
        },
        recentMembers,
        upcomingSessions
      })
    };

  } catch (err) {
    console.error('get-admin-stats error:', err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Could not load stats.' })
    };
  }
};
