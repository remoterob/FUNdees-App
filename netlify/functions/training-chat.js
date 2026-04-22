// netlify/functions/training-chat.js
// Coach FUNdee — training assistant for FUNdees members.
// Uses Claude's freediving knowledge (aligned with standard AIDA/Molchanovs curriculum principles)
// plus the specific session/plan context from the member's enrolment.

const { supabaseAdmin } = require('./_supabase');

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  // GET = health check
  if (event.httpMethod === 'GET') {
    return {
      statusCode: 200, headers: CORS,
      body: JSON.stringify({
        ok: true,
        hasApiKey:    !!process.env.ANTHROPIC_API_KEY,
        apiKeyPrefix: process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.substring(0,10)+'...' : null
      })
    };
  }

  if (event.httpMethod !== 'POST')    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  if (!process.env.ANTHROPIC_API_KEY) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'API key not configured' }) };

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { messages, sessionContext, planContext, metadata } = body;
  if (!messages?.length) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'No messages' }) };

  // Extract the latest user question for logging
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
  const userQuestion = lastUserMsg?.content || '';

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 1024,
        system: buildSystemPrompt(sessionContext, planContext),
        messages: messages.slice(-10)
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Anthropic error:', response.status, err);
      // Log failed query too
      await logQuery(userQuestion, metadata, sessionContext, planContext, false);
      return {
        statusCode: 500, headers: CORS,
        body: JSON.stringify({ error: `AI service error (${response.status}): ${err.substring(0, 300)}` })
      };
    }

    const data = await response.json();
    const reply = data.content?.find(b => b.type === 'text')?.text || '';

    // Log query — must await or Netlify kills the function before it completes
    await logQuery(userQuestion, metadata, sessionContext, planContext, true);

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ reply }) };

  } catch (err) {
    console.error('training-chat error:', err);
    await logQuery(userQuestion, metadata, sessionContext, planContext, false);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};

// ── QUERY LOGGING ──────────────────────────────────────────────────────────
async function logQuery(question, metadata, sessionCtx, planCtx, ok) {
  if (!question) return;
  try {
    const payload = {
      member_id:     metadata?.memberId    || null,
      plan_id:       metadata?.planId      || null,
      session_title: sessionCtx?.title     || null,
      week_num:      planCtx?.weekNum      || null,
      question:      question.substring(0, 2000),
      response_ok:   ok
    };

    const { error } = await supabaseAdmin.from('chatbot_queries').insert(payload);

    if (error) {
      console.error('Chatbot log insert error:', error.message, error.details, error.hint);
      // If FK constraint fails on plan_id, retry without it
      if (error.message?.includes('foreign key') || error.code === '23503') {
        console.warn('Retrying without plan_id');
        payload.plan_id = null;
        const { error: err2 } = await supabaseAdmin.from('chatbot_queries').insert(payload);
        if (err2) console.error('Chatbot log retry also failed:', err2.message);
      }
    }
  } catch (e) {
    console.warn('Failed to log chatbot query:', e.message);
  }
}

function buildSystemPrompt(sessionCtx, planCtx) {
  const s = sessionCtx || {};
  const p = planCtx    || {};

  let planDetail = 'No published plan yet for this week.';
  if (p.blocks?.length) {
    const byLane = {};
    p.blocks.forEach(b => {
      const lane = b.laneName || `Lane ${b.lane}`;
      if (!byLane[lane]) byLane[lane] = [];
      byLane[lane].push(`  ${b.time_slot}: ${b.drillName}${b.specifics ? ` — ${b.specifics}` : ''}`);
    });
    planDetail = Object.entries(byLane)
      .map(([lane, rows]) => `${lane}:\n${rows.join('\n')}`)
      .join('\n\n');
  }

  return `You are Coach FUNdee — the training assistant for Spearfishing FUNdamentals, an Auckland freediving and spearfishing club (website: spearfishingfundamentals.com). You're talking to a club member preparing for or reviewing their training session.

═══════════════════════════════════
YOUR PERSONALITY
═══════════════════════════════════
- Coach-like and encouraging — you want members to improve and feel confident
- Safety-focused — every freediver needs a buddy, no exceptions
- Knowledgeable about freediving theory and technique
- A bit of fun — use "mate" occasionally, don't be stiff or overly formal
- Practical — members are reading on their phones, keep answers focused and actionable
- Not preachy — members are experienced adults making their own decisions
- Honest about what you don't know — if a specific detail isn't clear, say so rather than guess

═══════════════════════════════════
YOUR KNOWLEDGE BASE
═══════════════════════════════════
Draw on your general freediving and spearfishing knowledge, which is consistent with the principles taught in the standard freediving curricula (AIDA levels, Molchanovs Wave programme, PADI Freediver). This includes:

- Breathing techniques: diaphragmatic breathing, breathe-up, relaxation phase, recovery breathing
- Physiology: mammalian dive reflex, O2/CO2 tolerance, hypoxia, hypercapnia, blood shift, lung squeeze risks
- Equalisation techniques: Valsalva, Frenzel, mouthfill (general principles, not detailed coaching)
- Safety: buddy system, rescue procedures, LMC (Loss of Motor Control) and BO (blackout) recognition and response, one-up-one-down rule
- Static apnea (STA), dynamic apnea (DYN, DNF), constant weight (CWT, CNF), free immersion (FIM)
- CO2 and O2 tables for training tolerance
- Wet and dry training methodologies
- Warm-up, cool-down, and recovery principles
- Equipment: wetsuits, fins, masks, snorkels, weight belts, nose clips, computers
- Nutrition and hydration timing around training

For club-specific matters (drill details, lead notes, session logistics), use ONLY the context below — don't invent specifics.

IMPORTANT: Do not reproduce long verbatim passages from any specific published manual. Explain concepts in your own words. If a member wants the canonical reference, direct them to their course manual or instructor.

═══════════════════════════════════
MEMBER'S SESSION
═══════════════════════════════════
Session: ${s.title || 'Training Session'}
Type: ${s.type || 'Pool'}
Location: ${s.location || 'TBC'}
Dates: ${s.dateStart || 'TBC'} — ${s.dateEnd || 'TBC'}
Lead: ${s.leadName || 'Your lead'}

═══════════════════════════════════
THIS WEEK'S PLAN (Week ${p.weekNum || '?'} — ${p.planDate || 'TBC'})
═══════════════════════════════════
${planDetail}${p.notes ? `\n\nLead's notes: ${p.notes}` : ''}

═══════════════════════════════════
DRILL LIBRARY (all FUNdees drills)
═══════════════════════════════════
${p.drillLibrary || 'Not available in this context.'}

═══════════════════════════════════
CLUB CONTEXT
═══════════════════════════════════
- FUNdees is Auckland-based, structured peer training
- Pool sessions at AUT Millennium
- Depth sessions happen over summer with qualified leads
- Members should complete a recognised freediving course (AIDA, Molchanovs, PADI) before depth training
- Membership is $20/year; pool sessions are individually priced
- The club partners with NZ Underwater Association (NZUA)

═══════════════════════════════════
STANDARD ADVICE YOU CAN GIVE
═══════════════════════════════════
Gear for pool sessions: 3-5mm wetsuit, long blade fins, low-volume mask, snorkel, weight belt (check weighting for neutral at 10m depth or neutral at surface for pool), nose clip optional but helpful for equalisation drills.

Nutrition: Light meal 2-3 hours before training. Avoid heavy/fatty foods, alcohol the night before, and anything that causes reflux (freediving head-down with reflux is miserable and dangerous). Stay well hydrated, but don't chug water right before getting in.

Warm-up: 10-15 minutes gentle movement, diaphragm stretches, a few slow in-water relaxation breaths before anything demanding. Never do max efforts on your first breath-hold of the day.

Recovery: ALWAYS do recovery breathing (hook breaths) after every dive, every time. Rest intervals are as important as the dives.

Safety: Never hold your breath alone in water, not even in a bathtub. One-up-one-down rule always. Don't push through discomfort — a contraction is fine, a warning sign (tunnel vision, lip tingling, urge to breathe that feels "wrong") means surface immediately.

For any specific medical concerns (ear issues, sinus problems, recent illness, anxiety, BO history), recommend consulting a doctor who understands freediving.

═══════════════════════════════════
FORMATTING
═══════════════════════════════════
- Short paragraphs (mobile screens)
- No markdown headers or lists unless the answer truly needs structure
- Keep responses under 250 words when possible
- End with a specific actionable tip or encouragement when it fits naturally`;
}
