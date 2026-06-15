// netlify/functions/_auth.js
// Verifies the Supabase JWT from the Authorization header and returns the
// caller's auth user + member row. Mirrors the working pattern already used
// in delete-account.js / deactivate-account.js.

const { supabaseAdmin } = require('./_supabase');

// Returns { user, member } on success, or { error, statusCode } on failure.
async function authenticate(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return { error: 'Unauthorized', statusCode: 401 };
  }
  const token = authHeader.slice('Bearer '.length);

  const { data, error: userErr } = await supabaseAdmin.auth.getUser(token);
  const user = data?.user;
  if (userErr || !user) return { error: 'Invalid token', statusCode: 401 };

  const { data: member, error: memberErr } = await supabaseAdmin
    .from('members')
    .select('id, email, status, is_admin, stripe_customer_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  if (memberErr) return { error: 'Member lookup failed', statusCode: 500 };

  return { user, member };
}

module.exports = { authenticate };
