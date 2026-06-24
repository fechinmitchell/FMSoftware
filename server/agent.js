// ------------------------------------------------------------------
//  FM Software — agentic workflow runner + Command Center
//  Mounted at /api/admin/workflow in index.js
// ------------------------------------------------------------------
const express = require('express');
const { requireAuth } = require('./auth');

const router = express.Router();

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
const ALLOWED_MODELS = new Set([
  'claude-opus-4-8',
  'claude-sonnet-4-6',
  'claude-haiku-4-5-20251001',
]);

// Rough list prices, USD per 1M tokens. Estimates only — edit if they drift.
const PRICES = {
  'claude-opus-4-8': { in: 15, out: 75 },
  'claude-sonnet-4-6': { in: 3, out: 15 },
  'claude-haiku-4-5-20251001': { in: 1, out: 5 },
};
const SEARCH_COST = 0.01; // ~ $10 per 1000 web searches

// ---- spend ceilings: server-side safety net, NOT trusted to the client ----
const MAX_CALL_USD = parseFloat(process.env.MAX_CALL_USD || '0.50');   // hard cap for any single model call
const DAILY_CAP_USD = parseFloat(process.env.DAILY_CAP_USD || '5');    // hard cap across all calls per UTC day
let daySpend = { day: '', usd: 0 };
function today() { return new Date().toISOString().slice(0, 10); }
function rollDay() { const d = today(); if (d !== daySpend.day) daySpend = { day: d, usd: 0 }; }
function dayRemaining() { rollDay(); return Math.max(0, DAILY_CAP_USD - daySpend.usd); }
function noteSpend(usd) { rollDay(); daySpend.usd += (usd || 0); }

// ---- tiny in-memory rate limiter (no external deps) ----
const RL_MAX = parseInt(process.env.RL_MAX || '60', 10);   // requests per window per IP
const RL_WINDOW_MS = 60 * 1000;
const rlHits = new Map();
function rateLimit(req, res, next) {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || 'unknown';
  const now = Date.now();
  let e = rlHits.get(ip);
  if (!e || now > e.reset) { e = { count: 0, reset: now + RL_WINDOW_MS }; rlHits.set(ip, e); }
  e.count += 1;
  if (e.count > RL_MAX) { res.set('Retry-After', String(Math.ceil((e.reset - now) / 1000))); return res.status(429).json({ error: 'Too many requests. Slow down.' }); }
  next();
}
router.use(rateLimit);

function costFor(model, usage, searches = 0) {
  const p = PRICES[model] || PRICES['claude-sonnet-4-6'];
  const inT = usage?.input_tokens || 0;
  const outT = usage?.output_tokens || 0;
  return (inT / 1e6) * p.in + (outT / 1e6) * p.out + searches * SEARCH_COST;
}

function interpolate(template, context) {
  return String(template || '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    const val = context[key];
    return val === undefined || val === null ? '' : String(val);
  });
}

// ---------- core call (used by flows) ----------
async function runLlm(prompt, system, model) {
  if (!ANTHROPIC_API_KEY) throw new Error('Server missing ANTHROPIC_API_KEY');
  const useModel = ALLOWED_MODELS.has(model) ? model : DEFAULT_MODEL;
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: useModel,
      max_tokens: 1500,
      system: system && system.trim() ? system : undefined,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!r.ok) throw new Error('Anthropic API: ' + (await r.text()).slice(0, 300));
  const data = await r.json();
  return (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
}

// ---------- agent call (system prompt + optional web search + usage/cost) ----------
function priceOf(model) { const pp = PRICES[model] || PRICES['claude-sonnet-4-6']; return { in: pp.in / 1e6, out: pp.out / 1e6 }; }

// callAgent. If maxCostUSD is set, it sizes max_tokens (and downgrades the model if needed) so the
// worst-case cost of THIS call stays under maxCostUSD, and skips cleanly if even a tiny answer won't fit.
async function callAgent({ system, prompt, model, webSearch, maxCostUSD, minTokens = 300 }) {
  if (!ANTHROPIC_API_KEY) throw new Error('Server missing ANTHROPIC_API_KEY');
  let useModel = ALLOWED_MODELS.has(model) ? model : DEFAULT_MODEL;
  let maxTokens = 4096;
  let searchUses = webSearch ? 5 : 0;

  // Every call is capped by the smaller of MAX_CALL_USD and what is left of today's DAILY_CAP_USD,
  // on top of any per-mission budget the client asked for. The client can only ever LOWER the cap.
  const ceiling = Math.min(MAX_CALL_USD, dayRemaining());
  const cap = (typeof maxCostUSD === 'number' && maxCostUSD > 0) ? Math.min(maxCostUSD, ceiling) : ceiling;
  if (cap <= 0) return { text: '', sources: [], usage: {}, costUSD: 0, model: useModel, skipped: true, reason: 'daily-cap' };
  {
    const sysLen = (system && system.trim()) ? system.length : 0;
    const promptLen = (prompt || '').length;
    // conservative input estimate: ~3.5 chars per token plus structural overhead
    let estIn = Math.ceil((sysLen + promptLen) / 3.5) + 200;
    if (webSearch) {
      searchUses = cap >= 0.12 ? 3 : (cap >= 0.05 ? 1 : 0);
      estIn += searchUses * 1500; // rough tokens pulled in by each search result set
    }
    const searchReserve = searchUses * (SEARCH_COST + 0.005);
    const fit = (m) => { const pr = priceOf(m); const inputCost = estIn * pr.in; const out = Math.floor((cap - inputCost - searchReserve) / pr.out); return out; };
    let out = fit(useModel);
    if (out < minTokens && useModel !== 'claude-haiku-4-5-20251001') { useModel = 'claude-haiku-4-5-20251001'; out = fit(useModel); }
    if (out < minTokens) return { text: '', sources: [], usage: {}, costUSD: 0, model: useModel, skipped: true, reason: 'budget' };
    maxTokens = Math.max(minTokens, Math.min(4096, out));
    if (searchUses === 0) webSearch = false;
  }

  const body = {
    model: useModel,
    max_tokens: maxTokens,
    system: system && system.trim() ? system : undefined,
    messages: [{ role: 'user', content: prompt }],
  };
  if (webSearch) {
    body.tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: searchUses || 5 }];
  }
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error('Anthropic API: ' + (await r.text()).slice(0, 300));
  const data = await r.json();
  const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();

  // pull any web search sources
  const sources = [];
  (data.content || []).forEach((b) => {
    if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) {
      b.content.forEach((it) => { if (it && it.url) sources.push({ url: it.url, title: it.title || it.url }); });
    }
  });
  const searches = data.usage?.server_tool_use?.web_search_requests || 0;
  const costUSD = costFor(useModel, data.usage, searches);
  noteSpend(costUSD);
  return { text, sources, usage: data.usage || {}, costUSD, model: useModel, skipped: false };
}

async function runFetch(url) {
  if (!/^https?:\/\//i.test(url)) throw new Error('URL must start with http:// or https://');
  const r = await fetch(url, { headers: { 'user-agent': 'FMSoftware-Agent/1.0' } });
  if (!r.ok) throw new Error(`Fetch got ${r.status} from ${url}`);
  const html = await r.text();
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.slice(0, 6000);
}

async function executeStep(step, context) {
  if (step.type === 'llm') {
    const prompt = interpolate(step.prompt, context);
    if (!prompt.trim()) throw new Error('Prompt is empty after filling variables');
    return await runLlm(prompt, interpolate(step.system, context), step.model);
  } else if (step.type === 'fetch') {
    return await runFetch(interpolate(step.url, context));
  } else if (step.type === 'template') {
    return interpolate(step.template, context);
  }
  throw new Error('Unknown step type: ' + step.type);
}

// ================= FLOW ENGINE (unchanged) =================
router.post('/run', requireAuth, async (req, res) => {
  const { input = '', steps = [] } = req.body || {};
  if (!Array.isArray(steps) || steps.length === 0) return res.status(400).json({ error: 'Add at least one step.' });
  const context = { input };
  const results = [];
  for (const step of steps) {
    const name = (step.name || '').trim() || 'step';
    const start = Date.now();
    try {
      const output = await executeStep(step, context);
      context[name] = output;
      results.push({ name, type: step.type, output, ms: Date.now() - start });
    } catch (err) {
      results.push({ name, type: step.type, error: err.message, ms: Date.now() - start });
      break;
    }
  }
  res.json({ results });
});

router.post('/run-stream', requireAuth, async (req, res) => {
  const { input = '', steps = [] } = req.body || {};
  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Cache-Control', 'no-cache');
  const write = (obj) => { if (!res.writableEnded) { try { res.write(JSON.stringify(obj) + '\n'); } catch {} } };
  if (!Array.isArray(steps) || steps.length === 0) { write({ event: 'error', error: 'Add at least one step.' }); return res.end(); }
  let cancelled = false;
  req.on('close', () => { cancelled = true; });
  const context = { input };
  for (const step of steps) {
    if (cancelled) break;
    const name = (step.name || '').trim() || 'step';
    const start = Date.now();
    write({ event: 'start', name, type: step.type });
    try {
      const output = await executeStep(step, context);
      if (cancelled) break;
      context[name] = output;
      write({ event: 'step', name, type: step.type, output, ms: Date.now() - start });
    } catch (err) {
      write({ event: 'step', name, type: step.type, error: err.message, ms: Date.now() - start });
      break;
    }
  }
  write({ event: cancelled ? 'cancelled' : 'done' });
  res.end();
});

const GENERATE_SYSTEM = `You design workflows for a node based automation canvas. You output a graph of nodes and edges as JSON.

Node types you can use:
- input: the single starting value. exactly one, with id "input". config field: value
- fetch: downloads a URL and returns its text. config field: url (may contain {{input}})
- llm: sends a prompt to Claude and returns the answer. config fields: system, prompt, model
- template: merges variables into text with no model call, free and instant. config field: template

Rules:
- return ONLY raw JSON, no markdown, no code fences, no preamble
- shape exactly: {"nodes":[{"id","type","name","value","url","system","prompt","template","model"}],"edges":[{"source","target"}]}
- include only the config fields that apply to each node type, omit the rest
- always include exactly one input node with id "input" and no name
- give every other node a short lowercase name with no spaces, that is how later nodes reference it
- inside prompts, templates and urls, reference earlier nodes with {{name}} and the start with {{input}}
- wire nodes with edges so data flows from each source to the nodes that use it
- choose model per llm node: claude-haiku-4-5-20251001 for speed and simple tasks, claude-sonnet-4-6 for normal drafting and analysis, claude-opus-4-8 for hard reasoning
- keep it between 3 and 6 nodes
- ids for non input nodes can be n1, n2, n3 and so on`;

router.post('/generate', requireAuth, async (req, res) => {
  try {
    const { description = '' } = req.body || {};
    if (!description.trim()) return res.status(400).json({ error: 'Describe what you want first.' });
    const text = await runLlm(`Build a workflow for this request:\n\n${description}`, GENERATE_SYSTEM, 'claude-sonnet-4-6');
    const clean = text.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
    let graph;
    try { graph = JSON.parse(clean); }
    catch { return res.status(502).json({ error: 'Model did not return valid JSON. Try rephrasing.' }); }
    if (!graph.nodes || !Array.isArray(graph.nodes)) return res.status(502).json({ error: 'Generated graph had no nodes.' });
    res.json({ nodes: graph.nodes, edges: graph.edges || [] });
  } catch (err) {
    console.error('generate error:', err);
    res.status(500).json({ error: 'Something went wrong generating.' });
  }
});

// ================= COMMAND CENTER =================
const COMMANDER_SYSTEM = `You are the Commander, a sharp strategist for a solo software contractor.

Given the person's profile and a goal, design a small team of 3 to 5 specialist AI agents that together could realistically achieve the goal. Think like a campaign: who researches, who writes, who finds opportunities, who tracks.

For each agent give:
- name: a short title, e.g. "Lead Scout"
- emoji: one single emoji that fits the role
- role: one or two sentences describing the agent's specialty and exactly how it moves the goal forward. Write it as an instruction to that agent, second person.
- firstTask: a concrete, specific first task tied to this exact goal, ready to run
- model: claude-haiku-4-5-20251001 for simple or fast work, claude-sonnet-4-6 for normal research and writing, claude-opus-4-8 for the hardest strategic reasoning

Return ONLY raw JSON, no markdown, no code fences, no preamble, exactly:
{"summary":"two or three sentences on the overall strategy","agents":[{"name","emoji","role","firstTask","model"}]}

Order the agents by dependency: the ones that gather information come first, the ones that use it come later. Every agent automatically receives the outputs of the agents listed before it, so write each firstTask to build directly on that upstream work rather than asking for it. For example a writer agent should say to use the targets the research agent found, not to wait for them.

Style: no hyphens, no Oxford commas, plain and direct.`;

router.post('/agent/plan', requireAuth, async (req, res) => {
  try {
    const { goal = '', profile = '', model } = req.body || {};
    if (!goal.trim()) return res.status(400).json({ error: 'Set a goal first.' });
    const prompt = `MY PROFILE:\n${profile || '(none given)'}\n\nMY GOAL:\n${goal}\n\nDesign the team that gets me there.`;
    const out = await callAgent({ system: COMMANDER_SYSTEM, prompt, model, webSearch: false });
    const clean = out.text.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
    let plan;
    try { plan = JSON.parse(clean); }
    catch { return res.status(502).json({ error: 'Commander did not return valid JSON. Try again.' }); }
    res.json({ summary: plan.summary || '', agents: plan.agents || [], costUSD: out.costUSD, model: out.model });
  } catch (err) {
    console.error('plan error:', err);
    res.status(500).json({ error: err.message || 'Planning failed.' });
  }
});

router.post('/agent/run', requireAuth, async (req, res) => {
  try {
    const { role = '', task = '', profile = '', model, webSearch = false, context = {}, goal = '' } = req.body || {};
    if (!task.trim()) return res.status(400).json({ error: 'Give the agent a task.' });
    const filledTask = interpolate(task, context);
    const filledRole = interpolate(role, context);

    // teammate work block, so an agent can use upstream output even without {{tokens}}
    const teammate = Object.entries(context)
      .filter(([, v]) => v && String(v).trim())
      .map(([k, v]) => `## ${k}\n${String(v).slice(0, 3500)}`)
      .join('\n\n');

    const system =
      `${filledRole}\n\n` +
      `The overall mission goal is: ${goal || '(not specified)'}\n\n` +
      (teammate
        ? `Here is work your teammates have already produced in this mission. Use whatever is relevant to your task. Never ask for information that is already here and never say you do not have it. If a teammate named specific companies or people, work from those named targets and do not invent generic substitutes.\n\n${teammate}\n\n`
        : '') +
      `You work for this person. Use their details so everything is specific to them and in their interest:\n${profile || '(no profile given)'}\n\n` +
      `Style: no hyphens, no Oxford commas, plain and direct. Be concrete and produce real, usable output, not a summary of what you would do. If you searched the web, finish with a short Sources list of the links you used.`;
    const out = await callAgent({ system, prompt: filledTask, model, webSearch, maxCostUSD: req.body.maxCostUSD });
    res.json(out);
  } catch (err) {
    console.error('agent run error:', err);
    res.status(500).json({ error: err.message || 'Agent run failed.' });
  }
});

// ---------- enhance a rough goal into a sharp mission brief ----------
const ENHANCE_SYSTEM = `You sharpen a goal into a focused mission brief for a solo software contractor.

Keep the person's intent but make it specific, measurable and time bound, and add the targets and constraints that let a team act on it. For example turn "get clients" into a brief naming how many, by when, in which niches, through which channels and what counts as success.

Keep it to 3 to 5 sentences. No hyphens, no Oxford commas. Return ONLY the improved mission text, no preamble, no quotes.`;

router.post('/agent/enhance', requireAuth, async (req, res) => {
  try {
    const { goal = '', profile = '', model } = req.body || {};
    if (!goal.trim()) return res.status(400).json({ error: 'Write a goal first.' });
    const out = await callAgent({
      system: ENHANCE_SYSTEM,
      prompt: `MY PROFILE:\n${profile || '(none)'}\n\nMY ROUGH GOAL:\n${goal}\n\nSharpen it into a mission brief.`,
      model, webSearch: false,
    });
    res.json({ goal: out.text.trim(), costUSD: out.costUSD });
  } catch (err) {
    console.error('enhance error:', err);
    res.status(500).json({ error: err.message || 'Enhance failed.' });
  }
});

// ---------- Mission Analyst: Q&A / synthesis over all the team's output ----------
router.post('/agent/ask', requireAuth, async (req, res) => {
  try {
    const { question = '', results = '', goal = '', profile = '', model, webSearch = false } = req.body || {};
    if (!question.trim()) return res.status(400).json({ error: 'Ask a question first.' });
    if (!results.trim()) return res.status(400).json({ error: 'No results yet. Run some agents first.' });
    const system =
      `You are the Mission Analyst. You read everything the team produced and turn it into clear, actionable answers for the person in charge.\n\n` +
      `The mission goal is: ${goal || '(not specified)'}\n\n` +
      `Here is the person's profile:\n${profile || '(none)'}\n\n` +
      `Here is everything the team has produced so far:\n\n${results}\n\n` +
      `Answer the question using this material. Be concrete, pull out the most useful and actionable points, and give the person something they can act on now. No hyphens, no Oxford commas.`;
    const out = await callAgent({ system, prompt: question, model, webSearch, maxCostUSD: req.body.maxCostUSD });
    res.json(out);
  } catch (err) {
    console.error('ask error:', err);
    res.status(500).json({ error: err.message || 'Ask failed.' });
  }
});

// ---------- Compiler: turn the team's output into typed, actionable deliverables ----------
const DISPATCH_SYSTEM = `You are the Compiler. You read everything the team produced and turn it into a list of clear deliverables the person can act on. Deliverables can be different kinds, not only emails.

Each item has a "type", one of:
- "email": an outreach or follow up email to a specific person or firm. Fields: name, to (email if known else ""), subject, body.
- "linkedin": a message to send on LinkedIn. Fields: name, url (their profile if known else ""), body (the message).
- "advice": a recommendation or insight with no send action. Fields: title, body.
- "code": code to add somewhere, for example a website change. Fields: title, language (e.g. jsx, html, js), body (one line saying where it goes), code (the actual code).
- "task": a concrete thing to do. Fields: title, body.

Pick the right type for each piece of the team's work. If the work is research and recommendations, use advice and task. If it names specific people or firms to contact, use email or linkedin. If it produced code or a site change, use code. A single mission can mix several types.

Return ONLY a raw JSON array, no markdown, no code fences, no preamble:
[{"type","name","to","url","subject","title","language","code","body"}]

Include only the fields that apply to each item, omit the rest. Write in the person's voice using their real proof. No hyphens, no Oxford commas. Keep messages under 130 words. If the material names specific firms or people, make an item for each.`;

router.post('/agent/dispatch', requireAuth, async (req, res) => {
  try {
    const { results = '', goal = '', profile = '', model } = req.body || {};
    if (!results.trim()) return res.status(400).json({ error: 'No results yet. Run some agents first.' });
    const system =
      `${DISPATCH_SYSTEM}\n\n` +
      `The mission goal is: ${goal || '(not specified)'}\n\n` +
      `Here is the person whose voice you write in:\n${profile || '(none)'}`;
    const out = await callAgent({
      system,
      prompt: `Here is everything the team produced:\n\n${results}\n\nProduce the outbox now as a JSON array.`,
      model, webSearch: false, maxCostUSD: req.body.maxCostUSD,
    });
    if (out.skipped) return res.json({ items: [], costUSD: 0, skipped: true });
    let txt = out.text.trim().replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
    const s = txt.indexOf('['); const e = txt.lastIndexOf(']');
    if (s >= 0 && e > s) txt = txt.slice(s, e + 1);
    let items;
    try { items = JSON.parse(txt); } catch { return res.status(502).json({ error: 'Dispatcher did not return valid items. Try again.' }); }
    if (!Array.isArray(items)) items = [];
    res.json({ items, costUSD: out.costUSD });
  } catch (err) {
    console.error('dispatch error:', err);
    res.status(500).json({ error: err.message || 'Dispatch failed.' });
  }
});

// ---------- Learn: fold a critique back into HAL.md so the system improves ----------
const LEARN_SYSTEM = `You maintain a HAL.md for a solo software contractor's AI agent team. It is the identity, voice, proof and hard won lessons that every agent reads before it works.

You are given the current HAL.md, the mission goal, what the team produced and the person's critique of those results. Produce an improved HAL.md that bakes the durable lessons in so future missions come back better.

Rules:
- keep it lean and scannable, under 400 words. A bloated HAL makes the agents worse because every word competes with the task.
- do not append endlessly. Merge, sharpen and replace. Drop anything stale or redundant.
- preserve the Identity, Voice, Proof, Niches and Offer sections. Keep the voice rule: no hyphens, no Oxford commas.
- update or add a "What works" section with concrete reusable lessons drawn from the critique, written as short imperatives the agents can follow.
- only record lessons that transfer across different clients and project types. The next mission may be a completely different client and domain, for example a psychotherapy practice rather than a law firm. Do not store facts about one specific client, project, deal or firm. No client names, no project specifics, no one off numbers. Write general principles about how the team should work.

Return ONLY the markdown for the new HAL.md, no preamble, no code fences.`;

router.post('/agent/learn', requireAuth, async (req, res) => {
  try {
    const { soul = '', goal = '', results = '', critique = '', model } = req.body || {};
    if (!critique.trim()) return res.status(400).json({ error: 'Write a critique first.' });
    const prompt =
      `CURRENT HAL.md:\n${soul || '(empty)'}\n\n` +
      `MISSION GOAL:\n${goal || '(not specified)'}\n\n` +
      `WHAT THE TEAM PRODUCED:\n${results || '(none yet)'}\n\n` +
      `MY CRITIQUE:\n${critique}\n\n` +
      `Return the improved HAL.md.`;
    const out = await callAgent({ system: LEARN_SYSTEM, prompt, model, webSearch: false, maxCostUSD: req.body.maxCostUSD });
    if (out.skipped) return res.json({ soul: '', costUSD: 0, skipped: true });
    let soulOut = out.text.trim().replace(/^```(?:markdown|md)?/i, '').replace(/```$/, '').trim();
    res.json({ soul: soulOut, costUSD: out.costUSD });
  } catch (err) {
    console.error('learn error:', err);
    res.status(500).json({ error: err.message || 'Learn failed.' });
  }
});

// ---------- Generate candidate business goals from HAL.md ----------
const GOALS_SYSTEM = `You are a growth strategist for a solo software contractor. Based on their HAL.md (identity, proof, niches and offer), propose 6 specific goals they could pursue over the next 1 to 3 months to grow revenue and build location independent recurring income.

Each goal:
- one sentence, concrete and measurable where it makes sense
- varied across the set: mix client acquisition, productised offers, rate and retainer moves, audience and distribution
- realistic for a solo operator, ambitious but doable

Return ONLY a raw JSON array of strings, no markdown, no code fences, no preamble. No hyphens, no Oxford commas.`;

router.post('/agent/goals', requireAuth, async (req, res) => {
  try {
    const { profile = '', model, steer = '' } = req.body || {};
    const prompt =
      `HAL.md:\n${profile || '(none)'}\n\n` +
      (steer.trim() ? `Adjustment from the person, honour this when choosing the goals:\n${steer}\n\n` : '') +
      `Propose the goals now as a JSON array of strings.`;
    const out = await callAgent({ system: GOALS_SYSTEM, prompt, model, webSearch: false });
    let txt = out.text.trim().replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
    const s = txt.indexOf('['); const e = txt.lastIndexOf(']');
    if (s >= 0 && e > s) txt = txt.slice(s, e + 1);
    let goals;
    try { goals = JSON.parse(txt); } catch { return res.status(502).json({ error: 'Could not generate goals. Try again.' }); }
    if (!Array.isArray(goals)) goals = [];
    res.json({ goals: goals.filter((g) => typeof g === 'string').slice(0, 8), costUSD: out.costUSD });
  } catch (err) {
    console.error('goals error:', err);
    res.status(500).json({ error: err.message || 'Goals failed.' });
  }
});

// ---------- Analyst: propose 3 sharp questions grounded in the team's results ----------
const ASKS_SYSTEM = `You are the Mission Analyst. You have read everything the team produced for a mission. Propose exactly 3 questions the person could ask you next to get the most value out of THIS specific material. Ground every question in what the team actually found and in the mission goal. Do not ask generic questions that would fit any mission.

Vary the three:
- one that surfaces the single best next action from the results
- one that interrogates a weakness, risk or gap in what the team produced
- one that pushes the work further or turns it into something concrete to ship

Each question is one sentence, short, and leads to an actionable answer. Return ONLY a raw JSON array of exactly 3 strings, no markdown, no code fences, no preamble. No hyphens, no Oxford commas.`;

router.post('/agent/questions', requireAuth, async (req, res) => {
  try {
    const { goal = '', results = '', profile = '', model } = req.body || {};
    if (!results.trim()) return res.status(400).json({ error: 'No results yet. Run some agents first.' });
    const prompt =
      `Mission goal: ${goal || '(not specified)'}\n\n` +
      `Person's profile:\n${profile || '(none)'}\n\n` +
      `Everything the team produced:\n\n${results}\n\n` +
      `Propose the 3 questions now as a JSON array of strings.`;
    const out = await callAgent({ system: ASKS_SYSTEM, prompt, model, webSearch: false });
    let txt = out.text.trim().replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
    const a = txt.indexOf('['); const b = txt.lastIndexOf(']');
    if (a >= 0 && b > a) txt = txt.slice(a, b + 1);
    let qs;
    try { qs = JSON.parse(txt); } catch { return res.status(502).json({ error: 'Could not generate questions. Try again.' }); }
    if (!Array.isArray(qs)) qs = [];
    res.json({ questions: qs.filter((q) => typeof q === 'string').slice(0, 3), costUSD: out.costUSD });
  } catch (err) {
    console.error('questions error:', err);
    res.status(500).json({ error: err.message || 'Questions failed.' });
  }
});

module.exports = router;