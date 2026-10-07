// netlify/functions/sc-my-team.js
//
// Spear & Cook — returns the CALLER's team for the active competition, plus
// their teammates' contact details. Members' email/phone aren't readable by
// other members under RLS, so this goes through the service-role client and
// only ever returns the caller's own teammates (never anyone else's details).
//
// Returns { team: null } if the caller isn't registered or hasn't been
// assigned to a team yet.

const { authenticate } = require('./_auth');
const { corsHeaders } = require('./_cors');
const { supabaseAdmin } = require('./_supabase');

exports.handler = async (event) => {
  const headers = corsHeaders(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  const auth = await authenticate(event);
  if (auth.error) return { statusCode: auth.statusCode, headers, body: JSON.stringify({ error: auth.error }) };
  const member = auth.member;
  if (!member) return { statusCode: 403, headers, body: JSON.stringify({ error: 'No member profile' }) };

  try {
    const { data: comp, error: compErr } = await supabaseAdmin
      .from('sc_competitions').select('id').eq('status', 'active').maybeSingle();
    if (compErr) throw compErr;
    if (!comp) return { statusCode: 200, headers, body: JSON.stringify({ team: null }) };

    const { data: me, error: meErr } = await supabaseAdmin
      .from('sc_competitors').select('id')
      .eq('competition_id', comp.id).eq('member_id', member.id).maybeSingle();
    if (meErr) throw meErr;
    if (!me) return { statusCode: 200, headers, body: JSON.stringify({ team: null }) };

    const { data: tm, error: tmErr } = await supabaseAdmin
      .from('sc_team_members').select('team_id, sc_teams(name, boat, photo_url)')
      .eq('competitor_id', me.id).maybeSingle();
    if (tmErr) throw tmErr;
    if (!tm?.team_id) return { statusCode: 200, headers, body: JSON.stringify({ team: null }) };

    const { data: rows, error: rErr } = await supabaseAdmin
      .from('sc_team_members')
      .select('sc_competitors(id, members(full_name, email, phone))')
      .eq('team_id', tm.team_id);
    if (rErr) throw rErr;

    const buddies = (rows || [])
      .map(r => r.sc_competitors)
      .filter(c => c && c.id !== me.id)
      .map(c => ({
        name: c.members?.full_name || '',
        email: c.members?.email || '',
        phone: c.members?.phone || ''
      }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ team: { name: tm.sc_teams?.name || '', boat: tm.sc_teams?.boat || '', photo_url: tm.sc_teams?.photo_url || '', buddies } })
    };
  } catch (err) {
    console.error('sc-my-team error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
