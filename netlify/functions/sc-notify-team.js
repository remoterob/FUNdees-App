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

    // Members → competitor → member (name/email/phone)
    const { data: rows, error: mErr } = await supabaseAdmin
      .from('sc_team_members')
      .select('sc_competitors(experience, members(full_name, email, phone))')
      .eq('team_id', team_id);
    if (mErr) throw mErr;

    // Everyone on the team is listed as a buddy; only people with an email get a message.
    const all = (rows || []).map(r => r.sc_competitors?.members).filter(Boolean);
    const recipients = all.filter(m => m.email);
    if (!recipients.length) return { statusCode: 200, headers, body: JSON.stringify({ sent: 0, note: 'No emails on file' }) };

    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const compName = team.sc_competitions?.name || 'Spear & Cook';
    const buddiesFor = (email) => {
      const others = all.filter(p => p.email !== email);
      if (!others.length) return '<p>No buddy assigned yet — the organisers will be in touch.</p>';
      return `<p><strong>Your buddy${others.length > 1 ? 's' : ''}:</strong></p>` + others.map(o => `
        <p style="margin:0 0 0.75rem">
          <strong>${esc(o.full_name)}</strong><br>
          ${o.email ? `Email: <a href="mailto:${esc(o.email)}">${esc(o.email)}</a><br>` : ''}
          ${o.phone ? `Phone: <a href="tel:${esc(o.phone)}">${esc(o.phone)}</a>` : ''}
        </p>`).join('');
    };

    let sent = 0;
    for (const p of recipients) {
      const html = `
        <p>Kia ora ${esc(p.full_name)},</p>
        <p>You've been teamed up for <strong>${esc(compName)}</strong>.</p>
        <p><strong>Team:</strong> ${esc(team.name)}${team.boat ? `<br><strong>Boat:</strong> ${esc(team.boat)}` : ''}</p>
        ${buddiesFor(p.email)}
        <p>Get in touch with your buddy before the day to plan your dive.</p>
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
