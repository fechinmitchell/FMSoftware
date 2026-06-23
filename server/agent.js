// ------------------------------------------------------------------
//  FM Software — agentic workflow runner
//  Mounted at /api/admin/workflow in index.js
//
//  The whole "agent engine" is here and it is small on purpose:
//    1. a shared `context` object
//    2. a loop over the steps
//    3. each step reads from context, writes its output back
//  That is what every workflow tool out there is doing underneath.
// ------------------------------------------------------------------
const express = require('express');
const { requireAuth } = require('./auth');

const router = express.Router();

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

// ---------- templating: replace {{name}} with context.name ----------
function interpolate(template, context) {
  return String(template || '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    const val = context[key];
    return val === undefined || val === null ? '' : String(val);
  });
}

// ---------- step type: llm ----------
async function runLlm(prompt, system) {
  if (!ANTHROPIC_API_KEY) throw new Error('Server missing ANTHROPIC_API_KEY');
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      system: system && system.trim() ? system : undefined,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!r.ok) throw new Error('Anthropic API: ' + (await r.text()).slice(0, 300));
  const data = await r.json();
  return (data.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
}

// ---------- step type: fetch ----------
async function runFetch(url) {
  if (!/^https?:\/\//i.test(url)) throw new Error('URL must start with http:// or https://');
  const r = await fetch(url, { headers: { 'user-agent': 'FMSoftware-Agent/1.0' } });
  if (!r.ok) throw new Error(`Fetch got ${r.status} from ${url}`);
  const html = await r.text();
  // crude strip to clean text so the model gets signal, not markup
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.slice(0, 6000); // keep it small + cheap
}

// ---------- the engine ----------
router.post('/run', requireAuth, async (req, res) => {
  const { input = '', steps = [] } = req.body || {};
  if (!Array.isArray(steps) || steps.length === 0) {
    return res.status(400).json({ error: 'Add at least one step.' });
  }

  const context = { input };   // <-- shared memory between steps
  const results = [];

  for (const step of steps) {
    const name = (step.name || '').trim() || 'step';
    const start = Date.now();
    try {
      let output = '';
      if (step.type === 'llm') {
        const prompt = interpolate(step.prompt, context);
        if (!prompt.trim()) throw new Error('Prompt is empty after filling variables');
        output = await runLlm(prompt, interpolate(step.system, context));
      } else if (step.type === 'fetch') {
        output = await runFetch(interpolate(step.url, context));
      } else {
        throw new Error('Unknown step type: ' + step.type);
      }
      context[name] = output;           // <-- next steps can now use {{name}}
      results.push({ name, type: step.type, output, ms: Date.now() - start });
    } catch (err) {
      results.push({ name, type: step.type, error: err.message, ms: Date.now() - start });
      break; // stop the chain on the first failure
    }
  }

  res.json({ results });
});

module.exports = router;