// ------------------------------------------------------------------
//  FM Software — admin auth + internal tools
//  Mounted at /api/admin in index.js
// ------------------------------------------------------------------
const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const JWT_SECRET = process.env.JWT_SECRET || 'please-set-a-real-secret';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
// Sonnet for good drafts. Swap to claude-haiku-4-5-20251001 to spend less.
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

// ---------- login ----------
router.post('/login', (req, res) => {
  const { password } = req.body || {};
  if (!ADMIN_PASSWORD) {
    return res.status(500).json({ error: 'Server not configured. Set ADMIN_PASSWORD.' });
  }
  if (!password || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Wrong password.' });
  }
  const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token });
});

// ---------- gate ----------
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not signed in.' });
  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Session expired. Sign in again.' });
  }
}

// ---------- check a token is still good (client boot) ----------
router.get('/me', requireAuth, (req, res) => res.json({ ok: true }));

// ---------- tool: outreach drafter ----------
const DRAFT_SYSTEM = `You write outreach for a freelance software contractor reaching companies that posted an AI, automation, or software role.

Style rules, follow exactly:
- no hyphens anywhere
- no Oxford commas
- plain, warm, direct, never salesy
- never use the words "leverage" or "synergy"
- the email body stays under 130 words
- the contractor is pitching contract or project work, not a full time job
- lead with the specific need from the posting and one relevant proof from the background

Return ONLY valid JSON, no markdown, no code fences, no preamble, exactly this shape:
{
  "subject": "short email subject line",
  "email": "the full email body",
  "linkedin": "a shorter version under 60 words for a LinkedIn message",
  "ideas": ["two or three short concrete things the contractor could build for them"],
  "followup": "a one line follow up to send if there is no reply"
}`;

router.post('/draft', requireAuth, async (req, res) => {
  try {
    if (!ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'Server not configured. Set ANTHROPIC_API_KEY.' });
    }
    const { background = '', jobText = '', contactName = '' } = req.body || {};
    if (!jobText.trim()) return res.status(400).json({ error: 'Paste a job posting first.' });

    const userContent =
      `MY BACKGROUND:\n${background}\n\n` +
      `THE JOB POSTING:\n${jobText}\n\n` +
      `CONTACT NAME (use if present, otherwise keep it general): ${contactName || 'unknown'}`;

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1200,
        system: DRAFT_SYSTEM,
        messages: [{ role: 'user', content: userContent }],
      }),
    });

    if (!r.ok) {
      const detail = await r.text();
      return res.status(502).json({ error: 'Anthropic API error.', detail });
    }

    const data = await r.json();
    const text = (data.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();

    // model is told to return pure JSON, but strip fences just in case
    const clean = text.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      // fall back gracefully so you still get something usable
      parsed = { subject: '', email: text, linkedin: '', ideas: [], followup: '' };
    }
    res.json(parsed);
  } catch (err) {
    console.error('draft error:', err);
    res.status(500).json({ error: 'Something went wrong drafting.' });
  }
});

module.exports = { router, requireAuth };