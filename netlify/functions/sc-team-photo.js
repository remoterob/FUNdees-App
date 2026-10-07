// netlify/functions/sc-team-photo.js
//
// Spear & Cook — sets a team's photo. Any member of a team can set their
// OWN team's photo (team membership is derived server-side from the
// caller, never trusted from the client). An admin may instead pass
// `team_id` to set any team's photo, e.g. from the Admin panel.
//
// Body: { photo_url, team_id? }   (photo_url: '' or null clears the photo)

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
    const body = JSON.parse(event.body || '{}');
    const photo_url = body.photo_url || null;

    let targetTeamId;

    if (member.is_admin && body.team_id) {
      const { data: t, error: tErr } = await supabaseAdmin.from('sc_teams').select('id').eq('id', body.team_id).maybeSingle();
      if (tErr) throw tErr;
      if (!t) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Team not found' }) };
      targetTeamId = t.id;
    } else {
      const { data: comp, error: compErr } = await supabaseAdmin
        .from('sc_competitions').select('id').eq('status', 'active').maybeSingle();
      if (compErr) throw compErr;
      if (!comp) return { statusCode: 400, headers, body: JSON.stringify({ error: 'No competition is open right now.' }) };

      const { data: competitor, error: cErr } = await supabaseAdmin
        .from('sc_competitors').select('id').eq('competition_id', comp.id).eq('member_id', member.id).maybeSingle();
      if (cErr) throw cErr;
      if (!competitor) return { statusCode: 400, headers, body: JSON.stringify({ error: 'You are not registered for this competition.' }) };

      const { data: tm, error: tmErr } = await supabaseAdmin
        .from('sc_team_members').select('team_id').eq('competitor_id', competitor.id).maybeSingle();
      if (tmErr) throw tmErr;
      if (!tm?.team_id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'You need to be assigned to a team before adding a team photo.' }) };
      targetTeamId = tm.team_id;
    }

    const { data: team, error } = await supabaseAdmin
      .from('sc_teams').update({ photo_url }).eq('id', targetTeamId).select('id, name, photo_url').single();
    if (error) throw error;

    return { statusCode: 200, headers, body: JSON.stringify({ team }) };
  } catch (err) {
    console.error('sc-team-photo error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
