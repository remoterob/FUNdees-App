// netlify/functions/training-chat.js
const fs   = require('fs');
const path = require('path');

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

function loadManual(filename) {
  try {
    const p = path.join(__dirname, filename);
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  } catch { return ''; }
}

const MANUAL_WAVE4 = loadManual('manual_wave4.txt');
const MANUAL_AIDA2 = loadManual('manual_aida2.txt');
const MANUAL_AIDA4 = loadManual('manual_aida4.txt');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST')    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  if (!process.env.ANTHROPIC_API_KEY) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'API key not configured' }) };

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { messages, sessionContext, planContext } = body;
  if (!messages?.length) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'No messages' }) };

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: buildSystemPrompt(sessionContext, planContext),
        messages: messages.slice(-10)
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Anthropic error:', err);
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'AI service error' }) };
    }

    const data = await response.json();
    const reply = data.content?.find(b => b.type === 'text')?.text || '';
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ reply }) };

  } catch (err) {
    console.error('training-chat error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};

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

  return `You are Coach FUNdee — the training assistant for Spearfishing FUNdamentals, an Auckland freediving and spearfishing club.

Your personality: coach-like and encouraging, safety-focused, genuinely knowledgeable about freediving theory and technique, and a bit of fun. Use "mate" occasionally. Keep answers practical and mobile-friendly (short paragraphs). Never be preachy — members are experienced adults making their own decisions.

Always reinforce buddy system and never-freedive-alone principles when relevant. For medical concerns, recommend consulting a doctor.

═══════════════════════════════════
MEMBER'S SESSION
═══════════════════════════════════
Session: ${s.title || 'Training Session'}
Type: ${s.type || 'Pool'}
Location: ${s.location || 'TBC'}
Dates: ${s.dateStart || 'TBC'} — ${s.dateEnd || 'TBC'}
Lead: ${s.leadName || 'Your lead'}

═══════════════════════════════════
WEEK ${p.weekNum || '?'} PLAN (${p.planDate || 'TBC'})
═══════════════════════════════════
${planDetail}${p.notes ? `\n\nLead notes: ${p.notes}` : ''}

═══════════════════════════════════
DRILL LIBRARY (all club drills)
═══════════════════════════════════
${p.drillLibrary || 'Not available.'}

═══════════════════════════════════
WAVE 4 FREEDIVING MANUAL
═══════════════════════════════════
${MANUAL_WAVE4 || 'Not loaded.'}

═══════════════════════════════════
AIDA 2 MANUAL
═══════════════════════════════════
${MANUAL_AIDA2 || 'Not loaded.'}

═══════════════════════════════════
AIDA 4 MANUAL
═══════════════════════════════════
${MANUAL_AIDA4 || 'Not loaded.'}

═══════════════════════════════════
STANDARD GUIDANCE
═══════════════════════════════════
Gear for pool sessions: wetsuit (3-5mm), long blade fins, mask, snorkel, weight belt, nose clip optional.
Nutrition: light meal 2-3 hours before, no heavy food, hydrate well. Avoid diving on a full or empty stomach.
Warm-up: 10-15 min gentle movement, diaphragm stretches, a few easy breath-holds in the water before training sets.
Recovery: recovery breathing after every dive. Rest intervals are as important as the dives themselves.`;
}
