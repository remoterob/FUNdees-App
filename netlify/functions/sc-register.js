// netlify/functions/sc-register.js
//
// Spear & Cook — competitor registration / profile save for the ACTIVE
// competition. Called from spear-and-cook.html with the member's Supabase
// JWT. Uses the service-role client so we control exactly which fields the
// client can write — notably `paid` / `payment_ref` can NEVER be set here
// (those are owned by the Stripe webhook in Phase 1b).
//
// Body (all optional except when accepting rules):
//   experience, preferred_partner, age_group, gender, club,
//   safety_contact, safety_phone, medical_info, boat_capacity_note
//   accept_rules (bool) + rules_accepted_name  → records rules acceptance

const { authenticate } = require('./_auth');
const { corsHeaders } = require('./_cors');
const { supabaseAdmin } = require('./_supabase');

// Fields a competitor is allowed to write about themselves.
const ALLOWED = [
  'experience', 'preferred_partner', 'age_group', 'gender', 'club',
  'safety_contact', 'safety_phone', 'medical_info', 'boat_capacity_note'
];

exports.handler = async (event) => {
  const headers = corsHeaders(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const auth = await authenticate(event);
  if (auth.error) return { statusCode: auth.statusCode, headers, body: JSON.stringify({ error: auth.error }) };
  const member = auth.member;
  if (!member) return { statusCode: 403, headers, body: JSON.stringify({ error: 'No member profile found for this account.' }) };

  try {
    const body = JSON.parse(event.body || '{}');

    // The one active competition
    const { data: comp, error: compErr } = await supabaseAdmin
      .from('sc_competitions')
      .select('*')
      .eq('status', 'active')
      .maybeSingle();
    if (compErr) throw compErr;
    if (!comp) return { statusCode: 400, headers, body: JSON.stringify({ error: 'No competition is open right now.' }) };

    // Is this member already registered? (existing competitors can always edit)
    const { data: existing } = await supabaseAdmin
      .from('sc_competitors')
      .select('id')
      .eq('competition_id', comp.id)
      .eq('member_id', member.id)
      .maybeSingle();

    // Registration gate — blocks NEW sign-ups when closed. `registration_open`
    // being undefined (pre-migration) is treated as open for safety.
    if (comp.registration_open === false && !existing) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Registration is not open yet. Check back soon.' }) };
    }

    // Whitelist the writable fields ('' → null)
    const fields = {};
    for (const k of ALLOWED) {
      if (k in body) fields[k] = body[k] === '' ? null : body[k];
    }

    // Optional rules acceptance
    if (body.accept_rules) {
      if (!body.rules_accepted_name || !body.rules_accepted_name.trim()) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Please type your name to accept the rules.' }) };
      }
      fields.rules_accepted_at = new Date().toISOString();
      fields.rules_accepted_name = body.rules_accepted_name.trim();
      fields.rules_version = comp.rules_version || null;
    }

    // Upsert the competitor row for (competition, member)
    let row;
    if (existing) {
      const { data, error } = await supabaseAdmin
        .from('sc_competitors')
        .update(fields)
        .eq('id', existing.id)
        .select('*')
        .single();
      if (error) throw error;
      row = data;
    } else {
      const { data, error } = await supabaseAdmin
        .from('sc_competitors')
        .insert({ competition_id: comp.id, member_id: member.id, ...fields })
        .select('*')
        .single();
      if (error) throw error;
      row = data;
    }

    return { statusCode: 200, headers, body: JSON.stringify({ competitor: row }) };
  } catch (err) {
    console.error('sc-register error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
