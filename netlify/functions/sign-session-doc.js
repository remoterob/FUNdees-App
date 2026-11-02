// netlify/functions/sign-session-doc.js
// Records a member's signature (typed name + date) against a session's current
// sign-up document. The document is read from the session here rather than
// taken from the request, so a signature can only ever apply to the live one.

const { supabaseAdmin } = require('./_supabase');
const { corsHeaders } = require('./_cors');
const { authenticate } = require('./_auth');

const MAX_NAME_LENGTH = 120;
// Noon UTC on the entered date is at most ~36h from now for anyone signing
// "today" in any timezone, including NZ being 13h ahead of UTC.
const MAX_DATE_DRIFT_MS = 36 * 60 * 60 * 1000;

exports.handler = async (event) => {
  const CORS = corsHeaders(event);
  const respond = (statusCode, body) => ({ statusCode, headers: CORS, body: JSON.stringify(body) });

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST')    return respond(405, { error: 'Method not allowed' });

  try {
    const { member, error: authError, statusCode } = await authenticate(event);
    if (authError) return respond(statusCode, { error: authError });
    if (!member)   return respond(403, { error: 'No member profile' });

    const { sessionId, signedName, signedDate } = JSON.parse(event.body || '{}');
    const name = typeof signedName === 'string' ? signedName.trim() : '';

    if (!sessionId) return respond(400, { error: 'Missing session' });
    if (name.length < 2 || name.length > MAX_NAME_LENGTH) return respond(400, { error: 'Please enter your full name.' });

    const signedAtNoon = /^\d{4}-\d{2}-\d{2}$/.test(signedDate || '') ? Date.parse(`${signedDate}T12:00:00Z`) : NaN;
    if (Number.isNaN(signedAtNoon) || Math.abs(signedAtNoon - Date.now()) > MAX_DATE_DRIFT_MS) {
      return respond(400, { error: "Please enter today's date." });
    }

    const { data: session, error: sErr } = await supabaseAdmin
      .from('sessions')
      .select('id, title, signup_doc_path, signup_doc_name')
      .eq('id', sessionId)
      .maybeSingle();

    if (sErr) throw new Error(`Session lookup: ${sErr.message}`);
    if (!session) return respond(404, { error: 'Session not found' });
    if (!session.signup_doc_path) return respond(400, { error: 'This session has no document to sign.' });

    // ignoreDuplicates keeps the first signature if the same member and
    // document are submitted twice (e.g. a double tap or two open tabs).
    const { error: insErr } = await supabaseAdmin
      .from('session_doc_signatures')
      .upsert({
        session_id:    session.id,
        member_id:     member.id,
        session_title: session.title,
        doc_path:      session.signup_doc_path,
        doc_name:      session.signup_doc_name || 'Sign-up document',
        signed_name:   name,
        signed_date:   signedDate
      }, { onConflict: 'session_id,member_id,doc_path', ignoreDuplicates: true });

    if (insErr) throw new Error(`Signature insert: ${insErr.message}`);

    return respond(200, { ok: true });

  } catch (err) {
    console.error('sign-session-doc error:', err);
    return respond(500, { error: 'Could not save your signature. Please try again.' });
  }
};
