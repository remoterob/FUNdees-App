// netlify/functions/deactivate-account.js
// Deactivates a member account (sets status to 'cancelled', records date).
// Does NOT delete any data — records retained for 7 years per ISA 2022.
const { supabaseAdmin } = require('./_supabase');
const { corsHeaders } = require('./_cors');

exports.handler = async (event) => {
  const CORS = corsHeaders(event);

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST')    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const token = (event.headers.authorization || event.headers.Authorization || '').replace('Bearer ', '');

    // Verify the token and get user
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Unauthorized' }) };

    // Deactivate — set status to cancelled, record deactivation date
    const { error: memberErr } = await supabaseAdmin
      .from('members')
      .update({
        status: 'cancelled',
        deactivated_at: new Date().toISOString()
      })
      .eq('auth_user_id', user.id);

    if (memberErr) throw new Error('Could not deactivate member record: ' + memberErr.message);

    // Sign out the user's sessions but keep the auth account
    await supabaseAdmin.auth.admin.signOut(user.id, 'global');

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ success: true }) };
  } catch(err) {
    console.error('deactivate-account error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Could not deactivate account.' }) };
  }
};
