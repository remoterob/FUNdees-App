// netlify/functions/daily-backup.js
//
// Scheduled (daily) backup. Exports every backup table from Supabase as a CSV
// and emails the files to the club secretary via Resend.
//
// Schedule is configured in netlify.toml ([functions."daily-backup"]).
// Env vars required:
//   RESEND_API_KEY   — Resend API key (sending domain must be verified)
//   BACKUP_SECRET    — guards manual HTTP invocation (scheduled runs are exempt)
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — via _supabase.js

const { supabaseAdmin } = require('./_supabase');

const TABLES = ['members', 'enrolments', 'session_bookings', 'membership_payments'];
const TO   = 'treasurer@spearfishingfundamentals.com';
const FROM = 'FUNdees Backups <backups@spearfishingfundamentals.com>';

// RFC-4180-ish CSV. Handles nulls, arrays (e.g. qualifications), objects,
// and escapes quotes/commas/newlines.
function toCsv(rows) {
  if (!rows || rows.length === 0) return 'No records';
  const cols = Object.keys(rows[0]);
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    let s = Array.isArray(v) ? v.join('; ')
          : (typeof v === 'object' ? JSON.stringify(v) : String(v));
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\r\n');
}

exports.handler = async (event) => {
  // Scheduled invocations include a `next_run` in the body. Any other (manual
  // HTTP) call must present the secret, so nobody can spam the inbox.
  const isScheduled = !!event.body && /next_run/.test(event.body);
  if (!isScheduled) {
    const key = event.headers?.['x-backup-key'] || event.queryStringParameters?.key;
    if (!process.env.BACKUP_SECRET || key !== process.env.BACKUP_SECRET) {
      return { statusCode: 401, body: 'Unauthorized' };
    }
  }

  if (!process.env.RESEND_API_KEY) {
    console.error('daily-backup: RESEND_API_KEY not set');
    return { statusCode: 500, body: 'Email not configured' };
  }

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Pacific/Auckland' }); // YYYY-MM-DD, NZ date

  try {
    const attachments = [];
    const summary = [];

    for (const table of TABLES) {
      const { data, error } = await supabaseAdmin.from(table).select('*');
      if (error) throw new Error(`${table}: ${error.message}`);
      attachments.push({
        filename: `${table}_${today}.csv`,
        content: Buffer.from(toCsv(data), 'utf8').toString('base64')
      });
      summary.push(`${table}: ${data?.length || 0} rows`);
    }

    const html = `
      <p>Daily FUNdees data backup — <strong>${today}</strong> (NZ time).</p>
      <ul>${summary.map(s => `<li>${s}</li>`).join('')}</ul>
      <p>The CSV files are attached. They contain members' personal data — please store them securely.</p>`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: FROM,
        to: [TO],
        subject: `FUNdees daily backup — ${today}`,
        html,
        attachments
      })
    });

    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Resend ${res.status}: ${detail}`);
    }

    console.log(`daily-backup sent — ${summary.join(', ')}`);
    return { statusCode: 200, body: JSON.stringify({ ok: true, summary }) };

  } catch (err) {
    console.error('daily-backup failed:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
