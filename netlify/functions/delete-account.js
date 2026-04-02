// netlify/functions/delete-account.js
// Deletes the authenticated user's member record and auth account.
// Uses service role key to delete from auth.users (anon key can't do this).

const { supabaseAdmin } = require('./_supabase');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST')    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    // Verify the caller is authenticated by checking their JWT
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Unauthorized' }) };
    }
    const token = authHeader.replace('Bearer ', '');

    // Verify the token and get the user
    const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !user) {
      return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Invalid token' }) };
    }

    // Delete member record first (FK constraint)
    const { error: memberErr } = await supabaseAdmin
      .from('members')
      .delete()
      .eq('auth_user_id', user.id);

    if (memberErr) throw new Error('Could not delete member record: ' + memberErr.message);

    // Delete the auth user
    const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    if (authErr) throw new Error('Could not delete auth user: ' + authErr.message);

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ success: true }) };

  } catch (err) {
    console.error('delete-account error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
