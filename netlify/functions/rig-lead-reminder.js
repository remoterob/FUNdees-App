// netlify/functions/rig-lead-reminder.js
//
// Weekly reminder to depth-training rig leads. Runs Saturday morning NZ time,
// alongside the daily backup (schedule in netlify.toml), and emails each lead
// one message listing their open rigs over the next 7 days (Sunday–Saturday),
// with who has joined so far.
//
// Only open rigs on scheduled (not cancelled) dates are included, so a
// cancelled rig or date never triggers a reminder.
//
// Scheduled runs include `next_run` in the body. Any other call must come from
// an admin (POST with their Supabase JWT), so a reminder can be sent on demand.
// Env vars: RESEND_API_KEY, plus SUPABASE_* via _supabase.js

const { authenticate } = require('./_auth');
const { corsHeaders } = require('./_cors');
const { supabaseAdmin } = require('./_supabase');

const FROM = 'FUNdees Training <noreply@spearfishingfundamentals.com>';
const APP_URL = process.env.URL || 'https://spearfishingfundamentals.com';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// YYYY-MM-DD in NZ time, offset by `days`.
function nzDate(days = 0) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Pacific/Auckland' });
  const d = new Date(today + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const fmtDate = (iso) => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const fmtTime = (r) => r.time_start ? r.time_start.slice(0, 5) + (r.time_end ? ' – ' + r.time_end.slice(0, 5) : '') : null;

exports.handler = async (event) => {
  const headers = corsHeaders(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  const isScheduled = !!event.body && /next_run/.test(event.body);
  if (!isScheduled) {
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    const auth = await authenticate(event);
    if (auth.error) return { statusCode: auth.statusCode, headers, body: JSON.stringify({ error: auth.error }) };
    if (!auth.member?.is_admin) return { statusCode: 403, headers, body: JSON.stringify({ error: 'Admins only' }) };
  }

  if (!process.env.RESEND_API_KEY) {
    console.error('rig-lead-reminder: RESEND_API_KEY not set');
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Email not configured (RESEND_API_KEY)' }) };
  }

  try {
    const from = nzDate(1), to = nzDate(7);

    const { data: occs, error: oErr } = await supabaseAdmin
      .from('depth_occurrences')
      .select('id, occurrence_date, sessions(title, location)')
      .eq('status', 'scheduled')
      .gte('occurrence_date', from)
      .lte('occurrence_date', to);
    if (oErr) throw oErr;
    if (!occs?.length) return { statusCode: 200, headers, body: JSON.stringify({ sent: 0, leads: 0, from, to }) };

    const occById = Object.fromEntries(occs.map(o => [o.id, o]));
    const { data: rigs, error: rErr } = await supabaseAdmin
      .from('rigs')
      .select('id, occurrence_id, lead_member_id, description, capacity, time_start, time_end, members!rigs_lead_member_id_fkey(full_name, email)')
      .in('occurrence_id', occs.map(o => o.id))
      .eq('status', 'open');
    if (rErr) throw rErr;
    if (!rigs?.length) return { statusCode: 200, headers, body: JSON.stringify({ sent: 0, leads: 0, from, to }) };

    const { data: joins, error: jErr } = await supabaseAdmin
      .from('rig_members')
      .select('rig_id, status, members(full_name)')
      .in('rig_id', rigs.map(r => r.id))
      .order('created_at');
    if (jErr) throw jErr;

    const byLead = new Map();
    for (const r of rigs) {
      const lead = r.members;
      if (!lead?.email) continue;
      if (!byLead.has(r.lead_member_id)) byLead.set(r.lead_member_id, { lead, rigs: [] });
      byLead.get(r.lead_member_id).rigs.push({ ...r, occ: occById[r.occurrence_id] });
    }

    let sent = 0;
    for (const { lead, rigs: mine } of byLead.values()) {
      mine.sort((a, b) => a.occ.occurrence_date.localeCompare(b.occ.occurrence_date) || (a.time_start || '').localeCompare(b.time_start || ''));

      const blocks = mine.map(r => {
        const people = (joins || []).filter(j => j.rig_id === r.id);
        const confirmed = people.filter(j => j.status === 'confirmed').map(j => esc(j.members?.full_name || 'Member'));
        const waiting = people.filter(j => j.status !== 'confirmed').map(j => esc(j.members?.full_name || 'Member'));
        const time = fmtTime(r);
        const sess = r.occ.sessions || {};
        return `
          <div style="border-left:3px solid #008c95;padding:6px 12px;margin:0 0 14px">
            <strong>${esc(fmtDate(r.occ.occurrence_date))}</strong>${time ? ` · ${esc(time)}` : ''}<br>
            ${esc(sess.title || 'Depth session')}${sess.location ? ` · ${esc(sess.location)}` : ''}<br>
            ${r.description ? `<em>${esc(r.description)}</em><br>` : ''}
            Divers (${confirmed.length}/${r.capacity}): ${confirmed.length ? confirmed.join(', ') : 'nobody has joined yet'}
            ${waiting.length ? `<br>Waitlist: ${waiting.join(', ')}` : ''}
          </div>`;
      }).join('');

      const missingDetails = mine.some(r => !r.time_start || !r.description);
      const html = `
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222;max-width:600px">
          <p>Kia ora ${esc(lead.full_name)},</p>
          <p>Just a reminder that you're rostered as a rig lead this coming week:</p>
          ${blocks}
          ${missingDetails ? '<p>Please add a start time and a short plan to your rig so divers know what to expect.</p>' : ''}
          <p>If you can't make it, please organise a swap with another lead, or let the organisers know as soon as possible.</p>
          <p><a href="${APP_URL}/">Open the app to view or edit your rig</a></p>
          <p>Dive safe!</p>
        </div>`;

      const first = mine[0].occ.occurrence_date;
      const subject = mine.length > 1
        ? `Rig lead reminder: you're leading ${mine.length} rigs this week`
        : `Rig lead reminder: ${fmtDate(first)}`;

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: FROM, to: [lead.email], subject, html })
      });
      if (res.ok) sent++;
      else console.error('rig-lead-reminder send failed:', await res.text());
      await new Promise(r => setTimeout(r, 600)); // stay under Resend's 2 requests/second
    }

    return { statusCode: 200, headers, body: JSON.stringify({ sent, leads: byLead.size, from, to }) };
  } catch (err) {
    console.error('rig-lead-reminder error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
