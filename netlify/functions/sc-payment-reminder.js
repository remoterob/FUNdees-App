// netlify/functions/sc-payment-reminder.js
//
// Spear & Cook — emails every registered competitor who hasn't paid the
// entry fee yet. Runs weekly on the schedule in netlify.toml. Does nothing
// unless there's an ACTIVE competition with an entry fee above zero.
//
// Scheduled runs include `next_run` in the body. Any other call must come
// from an admin (POST with their Supabase JWT), so they can send one now.
// Env vars: RESEND_API_KEY, plus SUPABASE_* via _supabase.js

const { authenticate } = require('./_auth');
const { corsHeaders } = require('./_cors');
const { supabaseAdmin } = require('./_supabase');

const FROM = 'Spear & Cook <noreply@spearfishingfundamentals.com>';
const APP_URL = process.env.URL || 'https://spearfishingfundamentals.com';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

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
    console.error('sc-payment-reminder: RESEND_API_KEY not set');
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Email not configured (RESEND_API_KEY)' }) };
  }

  try {
    const { data: comp, error: compErr } = await supabaseAdmin
      .from('sc_competitions').select('id, name, entry_fee')
      .eq('status', 'active').maybeSingle();
    if (compErr) throw compErr;

    const fee = Number(comp?.entry_fee) || 0;
    if (!comp || fee <= 0) {
      return { statusCode: 200, headers, body: JSON.stringify({ sent: 0, note: 'No active competition with an entry fee' }) };
    }

    const { data: unpaid, error: uErr } = await supabaseAdmin
      .from('sc_competitors')
      .select('members(full_name, email)')
      .eq('competition_id', comp.id)
      .eq('paid', false);
    if (uErr) throw uErr;

    const recipients = (unpaid || []).map(r => r.members).filter(m => m?.email);
    const feeText = `$${fee % 1 ? fee.toFixed(2) : fee} NZD`;

    let sent = 0;
    for (const p of recipients) {
      const html = `
        <p>Kia ora ${esc(p.full_name)},</p>
        <p>You're registered for <strong>${esc(comp.name)}</strong>, but your entry fee of <strong>${feeText}</strong> hasn't been paid yet.</p>
        <p>You'll need an active FUNdees membership as well — the app will let you know if it needs renewing.</p>
        <p><a href="${APP_URL}/spear-and-cook.html">Pay your entry in the app</a></p>
        <p>If you've already paid, please ignore this email — or let us know if it still shows as unpaid.</p>
        <p>Tight lines!</p>`;

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: FROM, to: [p.email], subject: `${comp.name} — entry fee reminder`, html })
      });
      if (res.ok) sent++;
      else console.error('sc-payment-reminder send failed:', await res.text());
    }

    return { statusCode: 200, headers, body: JSON.stringify({ sent, unpaid: recipients.length }) };
  } catch (err) {
    console.error('sc-payment-reminder error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
