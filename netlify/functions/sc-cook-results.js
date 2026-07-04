// netlify/functions/sc-cook-results.js
//
// Spear & Cook — aggregate cook-off scores per team. This is the ONLY
// path to the totals, and it returns them only when the organisers have
// revealed results (cook_results_visible) — or to an admin. That's the
// anti-gaming guard: judges can't watch the totals move as they vote.
//
// Each judge scores 0–5 on 4 criteria (max 20 per dish). An entry's score
// is the average of its judges' totals; a team's cook score is the sum of
// its entries' averages.

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
    const { data: comp } = await supabaseAdmin.from('sc_competitions').select('id, cook_results_visible').eq('status', 'active').maybeSingle();
    if (!comp) return { statusCode: 400, headers, body: JSON.stringify({ error: 'No competition is open right now.' }) };

    // Gate: hidden unless revealed, or the caller is an admin.
    if (!comp.cook_results_visible && !member.is_admin) {
      return { statusCode: 200, headers, body: JSON.stringify({ visible: false }) };
    }

    const [{ data: teams }, { data: entries }] = await Promise.all([
      supabaseAdmin.from('sc_teams').select('id, name').eq('competition_id', comp.id),
      supabaseAdmin.from('sc_cooking_entries').select('id, team_id, category, title').eq('competition_id', comp.id)
    ]);

    const entryIds = (entries || []).map(e => e.id);
    let votes = [];
    if (entryIds.length) {
      const { data: v } = await supabaseAdmin.from('sc_cooking_votes')
        .select('entry_id, presentation, flavour, creativity, wow').in('entry_id', entryIds);
      votes = v || [];
    }

    // Average total per entry
    const agg = {}; // entry_id -> { sum, count }
    for (const v of votes) {
      const total = (v.presentation||0) + (v.flavour||0) + (v.creativity||0) + (v.wow||0);
      const a = agg[v.entry_id] || (agg[v.entry_id] = { sum: 0, count: 0 });
      a.sum += total; a.count += 1;
    }

    const teamMap = {};
    (teams || []).forEach(t => { teamMap[t.id] = { team_id: t.id, name: t.name, cook_score: 0, entries: [], _sum: 0, _n: 0 }; });
    for (const e of (entries || [])) {
      const a = agg[e.id] || { sum: 0, count: 0 };
      const avg = a.count ? a.sum / a.count : 0;   // this dish's average judge total (out of 20)
      const tm = teamMap[e.team_id]; if (!tm) continue;
      tm.entries.push({ category: e.category, title: e.title, avg, count: a.count });
      if (a.count > 0) { tm._sum += avg; tm._n += 1; }
    }
    // Team cook score = the AVERAGE of its judged dishes, out of 20 (not a sum).
    Object.values(teamMap).forEach(t => { t.cook_score = t._n ? t._sum / t._n : 0; delete t._sum; delete t._n; });

    const result = Object.values(teamMap).sort((x, y) => y.cook_score - x.cook_score);
    return { statusCode: 200, headers, body: JSON.stringify({ visible: true, teams: result }) };
  } catch (err) {
    console.error('sc-cook-results error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
