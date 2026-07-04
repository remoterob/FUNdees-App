// netlify/functions/sc-log-claim.js
//
// Spear & Cook — log (or soft-delete) a catch. Points are computed
// SERVER-SIDE from the species base_points + a weight bonus, so the
// client can never inflate a score.
//
//   points = base_points + min(80, floor(weight_g / 100))
//   (1 pt per 100g, capped at +80 — matches the original competition)
//
// POST create:  { species_slug, weight_g, length_mm?, photo_url? }
// POST delete:  { action:'delete', claim_id }

const { authenticate } = require('./_auth');
const { corsHeaders } = require('./_cors');
const { supabaseAdmin } = require('./_supabase');

function pointsFor(base, weightG) {
  return (base || 0) + Math.min(80, Math.max(0, Math.floor((weightG || 0) / 100)));
}

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

    const { data: comp, error: compErr } = await supabaseAdmin
      .from('sc_competitions').select('id, spearing_open, status').eq('status', 'active').maybeSingle();
    if (compErr) throw compErr;
    if (!comp) return { statusCode: 400, headers, body: JSON.stringify({ error: 'No competition is open right now.' }) };

    const { data: competitor } = await supabaseAdmin
      .from('sc_competitors').select('id').eq('competition_id', comp.id).eq('member_id', member.id).maybeSingle();
    if (!competitor) return { statusCode: 400, headers, body: JSON.stringify({ error: 'You are not registered for this competition.' }) };

    // ── Soft-delete an existing claim ──
    if (body.action === 'delete') {
      const { claim_id } = body;
      if (!claim_id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'claim_id required' }) };
      const { data: cl } = await supabaseAdmin.from('sc_claims').select('id, competitor_id, verified').eq('id', claim_id).maybeSingle();
      if (!cl) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Catch not found' }) };
      if (cl.competitor_id !== competitor.id && !member.is_admin)
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'You can only remove your own catches.' }) };
      if (cl.verified && !member.is_admin)
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'A verified catch can only be removed by an admin.' }) };
      const { error } = await supabaseAdmin.from('sc_claims').update({ deleted: true }).eq('id', claim_id);
      if (error) throw error;
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    // ── Create a claim ──
    if (!comp.spearing_open)
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Catch logging is currently closed.' }) };

    const { data: tm } = await supabaseAdmin.from('sc_team_members').select('team_id').eq('competitor_id', competitor.id).maybeSingle();
    if (!tm?.team_id)
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'You need to be assigned to a team before logging catches.' }) };

    const species_slug = body.species_slug;
    const weight_g = Math.floor(Number(body.weight_g) || 0);
    const length_mm = body.length_mm ? Math.floor(Number(body.length_mm)) : null;
    if (!species_slug || weight_g <= 0)
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Species and a valid weight are required.' }) };
    if (!body.photo_url)
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'A photo of the catch is required.' }) };

    const { data: sp } = await supabaseAdmin.from('sc_species').select('slug, name, base_points').eq('slug', species_slug).maybeSingle();
    if (!sp) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown species.' }) };

    const points = pointsFor(sp.base_points, weight_g);

    const { data: claim, error } = await supabaseAdmin.from('sc_claims').insert({
      competition_id: comp.id,
      team_id: tm.team_id,
      competitor_id: competitor.id,
      species_slug: sp.slug,
      species: sp.name,
      weight_g,
      length_mm,
      photo_url: body.photo_url || null,
      points,
      verified: false
    }).select('*').single();
    if (error) throw error;

    return { statusCode: 200, headers, body: JSON.stringify({ claim }) };
  } catch (err) {
    console.error('sc-log-claim error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
