// netlify/functions/depth-rig-action.js
// Self-service management of depth-session rigs (a lead's dive plan on one
// dated occurrence, joined by enrolled+paid members). Mirrors the
// action-discriminated shape of admin-manage-enrolment.js. RLS on
// rigs/rig_members only allows admin writes from the client, so every
// lead/member write — and every removal, including admin's, so waitlist
// promotion always runs — goes through this function with the
// service-role key.
//
//   action: 'create_rig'   — a qualified lead opens a rig on an occurrence
//   action: 'update_rig'   — the rig's lead (or an admin) edits it
//   action: 'cancel_rig'   — the rig's lead (or an admin) cancels it
//   action: 'join_rig'     — an enrolled+paid member joins (or waitlists)
//   action: 'leave_rig'    — a member removes themselves, or an admin
//                             removes anyone via memberId; promotes the
//                             next waitlisted member if a confirmed spot frees up
//   action: 'admin_assign' — admin-only manual add/move onto a rig

const { supabaseAdmin } = require('./_supabase');
const { corsHeaders } = require('./_cors');
const { authenticate } = require('./_auth');

const FROM = 'FUNdees Training <noreply@spearfishingfundamentals.com>';

async function sendEmail(to, subject, html) {
  if (!process.env.RESEND_API_KEY || !to) return;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [to], subject, html })
    });
    if (!res.ok) console.error('depth-rig-action email failed:', await res.text());
  } catch (err) {
    console.error('depth-rig-action email error:', err.message);
  }
}

// Human-readable context about a rig for use in notification emails.
async function getRigContext(rigId) {
  const { data: rig } = await supabaseAdmin
    .from('rigs')
    .select('description, lead_member_id, time_start, time_end, depth_occurrences(occurrence_date, sessions(title, location))')
    .eq('id', rigId)
    .maybeSingle();
  if (!rig) return null;

  const occ = rig.depth_occurrences;
  const sess = occ?.sessions;
  const { data: lead } = await supabaseAdmin.from('members').select('full_name').eq('id', rig.lead_member_id).maybeSingle();

  return {
    dateLabel: occ ? new Date(occ.occurrence_date + 'T12:00:00').toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'an upcoming date',
    sessionTitle: sess?.title || 'Depth session',
    location: sess?.location || null,
    description: rig.description || null,
    timeLabel: rig.time_start ? `${rig.time_start.slice(0, 5)}${rig.time_end ? ' – ' + rig.time_end.slice(0, 5) : ''}` : null,
    leadName: lead?.full_name || 'the lead'
  };
}

exports.handler = async (event) => {
  const CORS = corsHeaders(event);

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST')    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };

  const { member, error: authError, statusCode } = await authenticate(event);
  if (authError) return { statusCode, headers: CORS, body: JSON.stringify({ error: authError }) };
  if (!member) return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'No member profile found' }) };

  try {
    const body = JSON.parse(event.body || '{}');
    const { action } = body;

    switch (action) {
      case 'create_rig':   return await createRig(member, body, CORS);
      case 'update_rig':   return await updateRig(member, body, CORS);
      case 'cancel_rig':   return await setRigStatus(member, body, 'cancelled', CORS);
      case 'join_rig':     return await joinRig(member, body, CORS);
      case 'leave_rig':    return await leaveRig(member, body, CORS);
      case 'admin_assign': return await adminAssign(member, body, CORS);
      default:
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Unknown action' }) };
    }
  } catch (err) {
    console.error('depth-rig-action error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Something went wrong. Please try again.' }) };
  }
};

// Active membership + a paid enrolment on the depth series this occurrence
// belongs to — the same "active + paid" gate used everywhere else.
async function isEnrolledAndPaid(member, sessionId) {
  if (member.status !== 'active') return false;
  const { data } = await supabaseAdmin
    .from('enrolments')
    .select('id')
    .eq('session_id', sessionId)
    .eq('member_id', member.id)
    .eq('status', 'enrolled')
    .maybeSingle();
  return !!data;
}

async function getOccurrence(occurrenceId) {
  const { data } = await supabaseAdmin
    .from('depth_occurrences')
    .select('id, session_id, status')
    .eq('id', occurrenceId)
    .maybeSingle();
  return data;
}

async function getRig(rigId) {
  const { data } = await supabaseAdmin
    .from('rigs')
    .select('id, occurrence_id, lead_member_id, capacity, status, depth_occurrences(session_id)')
    .eq('id', rigId)
    .maybeSingle();
  return data;
}

// Accepts "HH:MM" (optionally "HH:MM:SS"); returns null for blank/absent,
// or false if the value doesn't look like a time at all.
function normalizeTime(value) {
  if (value === undefined || value === null || value === '') return null;
  return /^\d{2}:\d{2}(:\d{2})?$/.test(value) ? value : false;
}

async function createRig(member, { occurrenceId, description, capacity, timeStart, timeEnd }, CORS) {
  if (!member.is_qualified_lead && !member.is_admin) {
    return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Only qualified leads can open a rig' }) };
  }
  if (!occurrenceId) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing occurrenceId' }) };

  const occurrence = await getOccurrence(occurrenceId);
  if (!occurrence) return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Occurrence not found' }) };
  if (occurrence.status !== 'scheduled') {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'This date has been cancelled' }) };
  }

  if (!(await isEnrolledAndPaid(member, occurrence.session_id))) {
    return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'You must be enrolled and paid for this depth session first' }) };
  }

  const { data: existing } = await supabaseAdmin
    .from('rigs')
    .select('id')
    .eq('occurrence_id', occurrenceId)
    .eq('lead_member_id', member.id)
    .maybeSingle();
  if (existing) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'You already have a rig on this date' }) };

  const cap = Math.max(1, Math.min(4, parseInt(capacity, 10) || 4));

  const start = normalizeTime(timeStart);
  const end = normalizeTime(timeEnd);
  if (start === false || end === false) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Times must be in HH:MM format' }) };
  }
  if (start && end && end <= start) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'End time must be after start time' }) };
  }

  const { data: rig, error } = await supabaseAdmin
    .from('rigs')
    .insert({ occurrence_id: occurrenceId, lead_member_id: member.id, description: description || null, capacity: cap, time_start: start, time_end: end })
    .select()
    .single();
  if (error) throw new Error(`Create rig: ${error.message}`);

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, rig }) };
}

async function updateRig(member, { rigId, description, capacity, timeStart, timeEnd }, CORS) {
  if (!rigId) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing rigId' }) };
  const rig = await getRig(rigId);
  if (!rig) return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Rig not found' }) };
  if (rig.lead_member_id !== member.id && !member.is_admin) {
    return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Only this rig\'s lead or an admin can edit it' }) };
  }

  const payload = {};
  if (description !== undefined) payload.description = description || null;
  if (capacity !== undefined) payload.capacity = Math.max(1, Math.min(4, parseInt(capacity, 10) || 4));
  if (timeStart !== undefined) {
    const start = normalizeTime(timeStart);
    if (start === false) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Start time must be in HH:MM format' }) };
    payload.time_start = start;
  }
  if (timeEnd !== undefined) {
    const end = normalizeTime(timeEnd);
    if (end === false) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'End time must be in HH:MM format' }) };
    payload.time_end = end;
  }
  if (payload.time_start && payload.time_end && payload.time_end <= payload.time_start) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'End time must be after start time' }) };
  }

  const { error } = await supabaseAdmin.from('rigs').update(payload).eq('id', rigId);
  if (error) throw new Error(`Update rig: ${error.message}`);

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
}

async function setRigStatus(member, { rigId }, status, CORS) {
  if (!rigId) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing rigId' }) };
  const rig = await getRig(rigId);
  if (!rig) return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Rig not found' }) };
  if (rig.lead_member_id !== member.id && !member.is_admin) {
    return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Only this rig\'s lead or an admin can cancel it' }) };
  }

  let displaced = [];
  if (status === 'cancelled') {
    const { data } = await supabaseAdmin
      .from('rig_members')
      .select('members(full_name, email)')
      .eq('rig_id', rigId);
    displaced = (data || []).map(r => r.members).filter(m => m?.email);
  }

  const { error } = await supabaseAdmin.from('rigs').update({ status }).eq('id', rigId);
  if (error) throw new Error(`Set rig status: ${error.message}`);

  if (displaced.length) {
    const ctx = await getRigContext(rigId);
    if (ctx) {
      await Promise.all(displaced.map(m => sendEmail(m.email, `Rig cancelled — ${ctx.sessionTitle}`, `
        <p>Kia ora ${m.full_name || ''},</p>
        <p><strong>${ctx.leadName}'s rig</strong> for <strong>${ctx.sessionTitle}</strong> on <strong>${ctx.dateLabel}</strong>${ctx.timeLabel ? ` (${ctx.timeLabel})` : ''} has been cancelled.</p>
        <p>Log in to join another rig on that date, or check back if a new one opens.</p>`)));
    }
  }

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
}

async function joinRig(member, { rigId }, CORS) {
  if (!rigId) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing rigId' }) };
  const rig = await getRig(rigId);
  if (!rig) return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Rig not found' }) };
  if (rig.status !== 'open') return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'This rig is no longer open' }) };
  if (rig.lead_member_id === member.id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "You're already running this rig" }) };

  const sessionId = rig.depth_occurrences?.session_id;
  if (!(await isEnrolledAndPaid(member, sessionId))) {
    return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'You must be enrolled and paid for this depth session first' }) };
  }

  const { data: existing } = await supabaseAdmin
    .from('rig_members')
    .select('id')
    .eq('rig_id', rigId)
    .eq('member_id', member.id)
    .maybeSingle();
  if (existing) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "You're already on this rig" }) };

  const { count: confirmedCount } = await supabaseAdmin
    .from('rig_members')
    .select('id', { count: 'exact', head: true })
    .eq('rig_id', rigId)
    .eq('status', 'confirmed');

  const status = (confirmedCount || 0) < rig.capacity ? 'confirmed' : 'waitlisted';

  const { error } = await supabaseAdmin.from('rig_members').insert({ rig_id: rigId, member_id: member.id, status });
  if (error) throw new Error(`Join rig: ${error.message}`);

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, status }) };
}

async function leaveRig(member, { rigId, memberId }, CORS) {
  if (!rigId) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing rigId' }) };

  const targetId = memberId || member.id;
  if (targetId !== member.id && !member.is_admin) {
    return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Admin access required to remove another member' }) };
  }

  const { data: row } = await supabaseAdmin
    .from('rig_members')
    .select('id, status')
    .eq('rig_id', rigId)
    .eq('member_id', targetId)
    .maybeSingle();
  if (!row) return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Not on this rig' }) };

  const { error } = await supabaseAdmin.from('rig_members').delete().eq('id', row.id);
  if (error) throw new Error(`Leave rig: ${error.message}`);

  if (row.status === 'confirmed') await promoteFromWaitlist(rigId);

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
}

async function adminAssign(member, { rigId, memberId, status }, CORS) {
  if (!member.is_admin) return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Admin access required' }) };
  if (!rigId || !memberId) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing fields' }) };
  const rigStatus = status === 'waitlisted' ? 'waitlisted' : 'confirmed';

  const { error } = await supabaseAdmin
    .from('rig_members')
    .upsert({ rig_id: rigId, member_id: memberId, status: rigStatus }, { onConflict: 'rig_id,member_id' });
  if (error) throw new Error(`Admin assign: ${error.message}`);

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
}

// Oldest waitlisted member on this rig moves to confirmed when a spot frees up.
async function promoteFromWaitlist(rigId) {
  const { data: rig } = await supabaseAdmin.from('rigs').select('capacity').eq('id', rigId).maybeSingle();
  if (!rig) return;

  const { count: confirmedCount } = await supabaseAdmin
    .from('rig_members')
    .select('id', { count: 'exact', head: true })
    .eq('rig_id', rigId)
    .eq('status', 'confirmed');
  if ((confirmedCount || 0) >= rig.capacity) return;

  const { data: next } = await supabaseAdmin
    .from('rig_members')
    .select('id, member_id')
    .eq('rig_id', rigId)
    .eq('status', 'waitlisted')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!next) return;

  await supabaseAdmin.from('rig_members').update({ status: 'confirmed' }).eq('id', next.id);

  const [{ data: member }, ctx] = await Promise.all([
    supabaseAdmin.from('members').select('full_name, email').eq('id', next.member_id).maybeSingle(),
    getRigContext(rigId)
  ]);
  if (member?.email && ctx) {
    await sendEmail(member.email, `You're in! A spot opened on ${ctx.sessionTitle}`, `
      <p>Kia ora ${member.full_name || ''},</p>
      <p>A spot opened up on <strong>${ctx.leadName}'s rig</strong> for <strong>${ctx.sessionTitle}</strong> on <strong>${ctx.dateLabel}</strong>${ctx.timeLabel ? ` (${ctx.timeLabel})` : ''}${ctx.location ? ` at ${ctx.location}` : ''}, and you've been moved off the waitlist and confirmed.</p>
      ${ctx.description ? `<p>Dive plan: ${ctx.description}</p>` : ''}
      <p>See you in the water!</p>`);
  }
}
