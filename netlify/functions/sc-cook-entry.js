// netlify/functions/sc-cook-entry.js
//
// Spear & Cook — a team submits / updates / removes a cook-off dish.
// One dish per category (cooked | raw | whole) per team.
// POST create/update: { category, title, photo_url? }
// POST delete:        { action:'delete', entry_id }

const { authenticate } = require('./_auth');
const { corsHeaders } = require('./_cors');
const { supabaseAdmin } = require('./_supabase');

const CATEGORIES = ['cooked', 'raw', 'whole'];

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

    const { data: comp } = await supabaseAdmin.from('sc_competitions').select('id').eq('status', 'active').maybeSingle();
    if (!comp) return { statusCode: 400, headers, body: JSON.stringify({ error: 'No competition is open right now.' }) };

    const { data: competitor } = await supabaseAdmin.from('sc_competitors').select('id').eq('competition_id', comp.id).eq('member_id', member.id).maybeSingle();
    if (!competitor) return { statusCode: 400, headers, body: JSON.stringify({ error: 'You are not registered for this competition.' }) };

    const { data: tm } = await supabaseAdmin.from('sc_team_members').select('team_id').eq('competitor_id', competitor.id).maybeSingle();
    if (!tm?.team_id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'You need to be on a team to submit dishes.' }) };
    const teamId = tm.team_id;

    // Delete
    if (body.action === 'delete') {
      const { entry_id } = body;
      const { data: e } = await supabaseAdmin.from('sc_cooking_entries').select('id, team_id').eq('id', entry_id).maybeSingle();
      if (!e) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Dish not found' }) };
      if (e.team_id !== teamId && !member.is_admin) return { statusCode: 403, headers, body: JSON.stringify({ error: 'You can only remove your own team\'s dish.' }) };
      const { error } = await supabaseAdmin.from('sc_cooking_entries').delete().eq('id', entry_id);
      if (error) throw error;
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    // Create / update
    const category = body.category;
    const title = (body.title || '').trim();
    if (!CATEGORIES.includes(category)) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid category.' }) };
    if (!title) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Dish name is required.' }) };

    const { data: existing } = await supabaseAdmin.from('sc_cooking_entries')
      .select('id, image_url').eq('team_id', teamId).eq('category', category).maybeSingle();

    if (existing) {
      // A photo is required — allow keeping the existing one, but never end up with none.
      if (!body.photo_url && !existing.image_url)
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'A photo of the dish is required.' }) };
      const patch = { title, submitted_by: member.id };
      if (body.photo_url) patch.image_url = body.photo_url;   // keep old photo if none supplied
      const { data, error } = await supabaseAdmin.from('sc_cooking_entries').update(patch).eq('id', existing.id).select('*').single();
      if (error) throw error;
      return { statusCode: 200, headers, body: JSON.stringify({ entry: data }) };
    } else {
      if (!body.photo_url)
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'A photo of the dish is required.' }) };
      const { data, error } = await supabaseAdmin.from('sc_cooking_entries')
        .insert({ competition_id: comp.id, team_id: teamId, category, title, image_url: body.photo_url, submitted_by: member.id })
        .select('*').single();
      if (error) throw error;
      return { statusCode: 200, headers, body: JSON.stringify({ entry: data }) };
    }
  } catch (err) {
    console.error('sc-cook-entry error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
