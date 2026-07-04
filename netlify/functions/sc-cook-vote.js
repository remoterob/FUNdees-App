// netlify/functions/sc-cook-vote.js
//
// Spear & Cook — a judge casts/updates their score for a dish.
// Anti-gaming rules enforced server-side:
//   • judging must be open (or caller is admin)
//   • you cannot vote on your own team's dish
//   • one vote per (entry, voter) — upserted
// Scores are 0–5 on presentation, flavour, creativity, wow.
// Aggregates are never returned here (see sc-cook-results).

const { authenticate } = require('./_auth');
const { corsHeaders } = require('./_cors');
const { supabaseAdmin } = require('./_supabase');

const clamp5 = (n) => Math.max(0, Math.min(5, Math.floor(Number(n) || 0)));

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
    const { entry_id } = body;
    if (!entry_id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'entry_id required' }) };

    const { data: comp } = await supabaseAdmin.from('sc_competitions').select('id, judging_open').eq('status', 'active').maybeSingle();
    if (!comp) return { statusCode: 400, headers, body: JSON.stringify({ error: 'No competition is open right now.' }) };
    if (!comp.judging_open && !member.is_admin) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Judging is not open.' }) };

    // Entry + its team
    const { data: entry } = await supabaseAdmin.from('sc_cooking_entries').select('id, team_id, competition_id').eq('id', entry_id).maybeSingle();
    if (!entry || entry.competition_id !== comp.id) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Dish not found' }) };

    // Can't judge your own team
    const { data: competitor } = await supabaseAdmin.from('sc_competitors').select('id').eq('competition_id', comp.id).eq('member_id', member.id).maybeSingle();
    if (competitor) {
      const { data: myTm } = await supabaseAdmin.from('sc_team_members').select('team_id').eq('competitor_id', competitor.id).maybeSingle();
      if (myTm?.team_id === entry.team_id && !member.is_admin) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'You cannot judge your own team.' }) };
      }
    }

    const vote = {
      entry_id,
      voter_id: member.id,
      presentation: clamp5(body.presentation),
      flavour: clamp5(body.flavour),
      creativity: clamp5(body.creativity),
      wow: clamp5(body.wow),
      updated_at: new Date().toISOString()
    };

    const { error } = await supabaseAdmin.from('sc_cooking_votes').upsert(vote, { onConflict: 'entry_id,voter_id' });
    if (error) throw error;

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error('sc-cook-vote error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
