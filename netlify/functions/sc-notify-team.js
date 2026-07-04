// netlify/functions/sc-notify-team.js
//
// Spear & Cook — emails every member of a team that they've been paired up.
// Admin-only. Uses Resend (same verified domain as the daily backup).
// Body: { team_id }

const { authenticate } = require('./_auth');
const { corsHeaders } = require('./_cors');
const { supabaseAdmin } = require('./_supabase');

const FROM = 'Spear & Cook <noreply@spearfishingfundamentals.com>';

exports.handler = async (event) => {
  const headers = corsHeaders(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  const auth = await authenticate(event);
  if (auth.error) return { statusCode: auth.statusCode, headers, body: JSON.stringify({ error: auth.error }) };
  if (!auth.member?.is_admin) return { statusCode: 403, headers, body: JSON.stringify({ error: 'Admins only' }) };

  if (!process.env.RESEND_API_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Email not configured (RESEND_API_KEY)' }) };
  }

  try {
    const { team_id } = JSON.parse(event.body || '{}');
    if (!team_id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'team_id required' }) };

    // Team + competition
    const { data: team, error: tErr } = await supabaseAdmin
      .from('sc_teams')
      .select('id, name, boat, competition_id, sc_competitions(name)')
      .eq('id', team_id)
      .single();
    if (tErr || !team) throw new Error('Team not found');

    // Members → competitor → member (name/email)
    const { data: rows, error: mErr } = await supabaseAdmin
      .from('sc_team_members')
      .select('sc_competitors(experience, members(full_name, email))')
      .eq('team_id', team_id);
    if (mErr) throw mErr;

    const people = (rows || [])
      .map(r => r.sc_competitors?.members)
      .filter(m => m && m.email);
    if (!people.length) return { statusCode: 200, headers, body: JSON.stringify({ sent: 0, note: 'No emails on file' }) };

    const compName = team.sc_competitions?.name || 'Spear & Cook';
    const teammatesFor = (email) => people.filter(p => p.email !== email).map(p => p.full_name).join(', ') || '—';

    let sent = 0;
    for (const p of people) {
      const html = `
        <p>Kia ora ${p.full_name || ''},</p>
        <p>You've been teamed up for <strong>${compName}</strong>.</p>
        <ul>
          <li><strong>Team:</strong> ${team.name}</li>
          <li><strong>Your teammate(s):</strong> ${teammatesFor(p.email)}</li>
          ${team.boat ? `<li><strong>Boat:</strong> ${team.boat}</li>` : ''}
        </ul>
        <p>Log in to the app to see your team, the rules and (on the day) log your catch and cook-off entries.</p>
        <p>Dive safe — tight lines!</p>`;

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: FROM, to: [p.email], subject: `${compName} — your team`, html })
      });
      if (res.ok) sent++;
      else console.error('sc-notify-team send failed:', await res.text());
    }

    return { statusCode: 200, headers, body: JSON.stringify({ sent }) };
  } catch (err) {
    console.error('sc-notify-team error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
