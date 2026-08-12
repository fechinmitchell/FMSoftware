// ------------------------------------------------------------------
//  FM Software — Agent HQ endpoints
//  Mounted at /api/admin/hq in index.js
//  route   — the Kensei (master agent) picks the model (price vs performance)
//  kaizen  — pull a reusable lesson out of a run
//  improve — write the next version of an agent from output + critique
//  build   — draft a whole new agent from a description
//  ideas   — propose new agent ideas (uses web search for community patterns)
//  blog/publish — commit a markdown post to GitHub → Vercel deploys it
//  Every endpoint reports costUSD so the client ledger stays honest.
// ------------------------------------------------------------------
const express = require('express');
const { requireAuth } = require('./auth');

const router = express.Router();

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const HAIKU = 'claude-haiku-4-5-20251001';
const SONNET = 'claude-sonnet-4-6';
const ALLOWED = new Set([HAIKU, SONNET, 'claude-opus-4-8']);

// rough list prices, USD per 1M tokens — keep in sync with agent.js
const PRICES = {
  'claude-opus-4-8': { in: 15, out: 75 },
  'claude-sonnet-4-6': { in: 3, out: 15 },
  'claude-haiku-4-5-20251001': { in: 1, out: 5 },
};
const SEARCH_COST = 0.01;

async function claude({ system, prompt, model = HAIKU, maxTokens = 1200, webSearch = false }) {
  if (!ANTHROPIC_API_KEY) throw new Error('Server missing ANTHROPIC_API_KEY');
  const body = {
    model, max_tokens: maxTokens,
    system: system || undefined,
    messages: [{ role: 'user', content: prompt }],
  };
  if (webSearch) body.tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }];
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error('Anthropic API: ' + (await r.text()).slice(0, 300));
  const data = await r.json();
  const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
  const searches = data.usage?.server_tool_use?.web_search_requests || 0;
  const p = PRICES[model] || PRICES[SONNET];
  const costUSD =
    ((data.usage?.input_tokens || 0) / 1e6) * p.in +
    ((data.usage?.output_tokens || 0) / 1e6) * p.out +
    searches * SEARCH_COST;
  return { text, costUSD };
}

function parseJson(text) {
  let t = text.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
  const a = Math.min(...['{', '['].map((c) => { const i = t.indexOf(c); return i < 0 ? Infinity : i; }));
  const b = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
  if (a !== Infinity && b > a) t = t.slice(a, b + 1);
  return JSON.parse(t);
}

/* ---------------- route: the master picks the model ---------------- */
const ROUTE_SYSTEM = `You are the Kensei, the master agent commanding a solo software contractor's AI team. You assign the cheapest Claude model that will still do the job well.

Models and rough cost per run:
- claude-haiku-4-5-20251001: cents. Classifying, extraction, short drafts, simple summaries.
- claude-sonnet-4-6: ~5-15c. Research, web search, solid writing, most real work.
- claude-opus-4-8: ~50c+. Only genuinely hard multi step reasoning or high stakes strategy.

Consider: does the task need web research (Sonnet minimum), deep reasoning (Opus), or is it simple (Haiku)? Check the recent history: if a cheaper model kept succeeding, downgrade. If runs failed or got rejected, escalate one tier.

Return ONLY raw JSON: {"model":"<model id>","reason":"<under 12 words>"}`;

router.post('/route', requireAuth, async (req, res) => {
  const { name = '', role = '', task = '', webSearch = false, masterKaizen = '', history = [] } = req.body || {};
  try {
    const prompt =
      `AGENT: ${name}\nWEB SEARCH: ${webSearch}\nROLE:\n${role.slice(0, 800)}\nTASK:\n${task.slice(0, 800)}\n\n` +
      `RECENT RUNS (model, ok, cost): ${JSON.stringify(history)}\n\n` +
      (masterKaizen ? `YOUR OWN LESSONS:\n${masterKaizen.slice(0, 800)}\n\n` : '') +
      `Pick the model.`;
    const out = await claude({ system: ROUTE_SYSTEM, prompt, model: HAIKU, maxTokens: 200 });
    const pick = parseJson(out.text);
    if (!ALLOWED.has(pick.model)) throw new Error('bad model');
    res.json({ model: pick.model, reason: 'kensei: ' + (pick.reason || 'assigned'), costUSD: out.costUSD });
  } catch {
    // never block a run on routing — fall back to a sane default
    res.json({ model: webSearch ? SONNET : HAIKU, reason: 'fallback default', costUSD: 0 });
  }
});

/* ---------------- kaizen: one lesson per run ---------------- */
const KAIZEN_SYSTEM = `You review one AI agent run and extract at most 2 short reusable lessons that would make the NEXT run better. Lessons must be general craft improvements (structure, specificity, sourcing, tone), never facts about one company. If the output was already good and you have no real lesson, return an empty string. One lesson per line, each a short imperative under 15 words. Return ONLY the lesson lines, nothing else.`;

router.post('/kaizen', requireAuth, async (req, res) => {
  const { name = '', role = '', task = '', output = '' } = req.body || {};
  try {
    const out = await claude({
      system: KAIZEN_SYSTEM,
      prompt: `AGENT: ${name}\nROLE:\n${role.slice(0, 600)}\nTASK:\n${task.slice(0, 600)}\n\nOUTPUT:\n${output.slice(0, 4000)}`,
      model: HAIKU, maxTokens: 150,
    });
    res.json({ lessons: out.text.slice(0, 400), costUSD: out.costUSD });
  } catch (err) {
    res.json({ lessons: '', costUSD: 0 }); // kaizen is best effort, never a UI error
  }
});

/* ---------------- improve: write the next version ---------------- */
const IMPROVE_SYSTEM = `You improve an AI agent's prompts for a solo software contractor in Galway. You are given the current role and task, the agent's learned lessons, its last output and optionally the owner's critique. Rewrite the role and task so the next run is sharply better: more specific, tighter output format, lessons baked in. Keep the same job and roughly the same length. Never add fake credentials or clients. No hyphens, no Oxford commas.

Return ONLY raw JSON: {"role":"...","task":"...","note":"<under 10 words: what changed>"}`;

router.post('/improve', requireAuth, async (req, res) => {
  const { role = '', task = '', kaizen = '', lastOutput = '', critique = '' } = req.body || {};
  if (!role.trim() && !task.trim()) return res.status(400).json({ error: 'Nothing to improve.' });
  try {
    const prompt =
      `CURRENT ROLE:\n${role}\n\nCURRENT TASK:\n${task}\n\n` +
      (kaizen ? `LESSONS LEARNED:\n${kaizen}\n\n` : '') +
      (lastOutput ? `LAST OUTPUT:\n${lastOutput.slice(0, 3500)}\n\n` : '') +
      (critique ? `THE OWNER'S CRITIQUE (weight this heavily):\n${critique}\n\n` : '') +
      `Write the improved version now.`;
    const out = await claude({ system: IMPROVE_SYSTEM, prompt, model: SONNET, maxTokens: 1600 });
    const v = parseJson(out.text);
    if (!v.role || !v.task) throw new Error('incomplete');
    res.json({ role: v.role, task: v.task, note: v.note || 'improved', costUSD: out.costUSD });
  } catch (err) {
    res.status(502).json({ error: 'Could not write the new version. Try again.' });
  }
});

/* ---------------- build: draft a new agent ---------------- */
const BUILD_SYSTEM = `You design one specialist AI agent for a solo software contractor. Given a description, produce the agent: a short name, one fitting emoji, a role (its system prompt, second person, two or three sentences), a concrete repeatable task, whether it needs web search, and a starting model (claude-haiku-4-5-20251001 simple, claude-sonnet-4-6 normal, claude-opus-4-8 hard reasoning — or "auto" to let the Kensei master agent decide, prefer "auto").

Return ONLY raw JSON, no trailing text, exactly this shape:
{"name":"...","emoji":"...","role":"...","task":"...","webSearch":true,"model":"auto"}
No hyphens, no Oxford commas.`;

router.post('/build', requireAuth, async (req, res) => {
  const { description = '', profile = '' } = req.body || {};
  if (!description.trim()) return res.status(400).json({ error: 'Describe the agent first.' });
  try {
    const out = await claude({
      system: BUILD_SYSTEM,
      prompt: `OWNER PROFILE:\n${profile.slice(0, 1500) || '(none)'}\n\nAGENT WANTED:\n${description}`,
      model: SONNET, maxTokens: 900,
    });
    const a = parseJson(out.text);
    if (!a.name || !a.role || !a.task) throw new Error('incomplete');
    res.json({ name: a.name, emoji: a.emoji || '🤖', role: a.role, task: a.task, webSearch: !!a.webSearch, model: a.model || 'auto', costUSD: out.costUSD });
  } catch (err) {
    res.status(502).json({ error: 'Could not draft the agent. Try rephrasing.' });
  }
});

/* ---------------- ideas: propose new agents ---------------- */
const IDEAS_SYSTEM = `You are a growth strategist for FM Software, a one person software, automation and AI studio in Galway Ireland (custom software, workflow automation, AI integrations for businesses, law firms, NGOs and public sector). You propose ideas for new AI agents the owner could add to his agent team.

Use web search to check what agent builders are currently sharing in the community (GitHub lists like awesome ai agents, r/AI_Agents and similar) and adapt the good patterns to THIS business. Do not propose anything needing a team to operate.

Propose exactly 6 ideas across three angles, roughly two each:
- "team": builds on or feeds the agents he already has
- "new": something fresh his business clearly needs
- "community": a popular public agent pattern adapted to his business

Each idea: {"title":"3 to 6 words","pitch":"one sentence, what it does and the concrete business outcome","angle":"team|new|community"}

Return ONLY a raw JSON array of 6 objects, no markdown, no preamble. No hyphens, no Oxford commas.`;

router.post('/ideas', requireAuth, async (req, res) => {
  const { profile = '', agents = [], masterKaizen = '' } = req.body || {};
  try {
    const prompt =
      `OWNER PROFILE:\n${profile.slice(0, 1500) || '(none)'}\n\n` +
      `CURRENT TEAM:\n${agents.map((a) => `- ${a.name}: ${(a.role || '').slice(0, 160)}`).join('\n') || '(none yet)'}\n\n` +
      (masterKaizen ? `WHAT THE OWNER APPROVES AND REJECTS:\n${masterKaizen.slice(0, 600)}\n\n` : '') +
      `Propose the 6 agent ideas now as a JSON array.`;
    const out = await claude({ system: IDEAS_SYSTEM, prompt, model: SONNET, maxTokens: 1400, webSearch: true });
    let ideas = parseJson(out.text);
    if (!Array.isArray(ideas)) ideas = [];
    ideas = ideas.filter((i) => i && i.title && i.pitch).slice(0, 8);
    res.json({ ideas, costUSD: out.costUSD });
  } catch (err) {
    console.error('ideas error:', err);
    res.status(502).json({ error: 'Could not generate ideas. Try again.' });
  }
});

/* ---------------- analyse: saved output → action plan ---------------- */
const ANALYSE_SYSTEM = `You turn an AI agent's output into a tight action plan for a solo software contractor in Galway. Read the output and produce a short title, a two sentence summary and 3 to 8 concrete actionable steps in priority order. Each step starts with a verb and is something he can actually do today or this week. If the output names specific companies, people, files or links, keep them in the steps. No hyphens, no Oxford commas.

Return ONLY raw JSON: {"title":"...","summary":"...","steps":["...","..."]}`;

router.post('/analyse', requireAuth, async (req, res) => {
  const { output = '', agentName = '', profile = '' } = req.body || {};
  if (!output.trim()) return res.status(400).json({ error: 'Nothing to analyse.' });
  try {
    const out = await claude({
      system: ANALYSE_SYSTEM,
      prompt: `AGENT: ${agentName}\nOWNER PROFILE:\n${profile.slice(0, 800)}\n\nOUTPUT:\n${output.slice(0, 9000)}`,
      model: SONNET, maxTokens: 900,
    });
    const a = parseJson(out.text);
    res.json({
      title: a.title || 'Saved output', summary: a.summary || '',
      steps: Array.isArray(a.steps) ? a.steps.filter((s) => typeof s === 'string').slice(0, 10) : [],
      costUSD: out.costUSD,
    });
  } catch (err) {
    res.status(502).json({ error: 'Could not analyse. Try again.' });
  }
});

/* ---------------- scan-repo: the Security Scanner's engine ---------------- */
// Real scanning, not vibes: pulls the repo tree via the GitHub API, runs secret
// patterns over every text file, then Sonnet reviews the riskiest files.
// Uses GITHUB_TOKEN if set (needed for private repos + decent rate limits).
const SECRET_PATTERNS = [
  ['Anthropic API key', /sk-ant-[A-Za-z0-9_-]{10,}/],
  ['GitHub token', /(?:github_pat_|ghp_|gho_|ghs_)[A-Za-z0-9_]{10,}/],
  ['AWS access key', /AKIA[0-9A-Z]{16}/],
  ['Google API key', /AIza[0-9A-Za-z_-]{30,}/],
  ['Slack token', /xox[baprs]-[A-Za-z0-9-]{10,}/],
  ['Stripe key', /sk_(?:live|test)_[A-Za-z0-9]{16,}/],
  ['Resend key', /re_[A-Za-z0-9]{20,}/],
  ['Private key block', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['Hardcoded secret assignment', /(?:api[_-]?key|secret|token|password|passwd)\s*[:=]\s*["'][^"'\s]{12,}["']/i],
];
const SKIP_DIRS = /(^|\/)(node_modules|dist|build|\.git|coverage|vendor|\.next)(\/|$)/;
const SKIP_FILES = /package-lock\.json|yarn\.lock|pnpm-lock|\.min\.(js|css)$/;
const TEXT_FILE = /\.(js|jsx|ts|tsx|mjs|cjs|json|yml|yaml|md|txt|html|css|py|rb|go|php|sh|toml|ini|cfg|conf|xml|sql|env)$|(^|\/)\.[^/]*env[^/]*$|(^|\/)(Dockerfile|Procfile|Makefile|\.gitignore)$/i;

async function gh(path, token) {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'fmsoftware-hq' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(`https://api.github.com${path}`, { headers });
  if (!r.ok) throw new Error(`GitHub ${r.status} on ${path.split('?')[0]}`);
  return r.json();
}

const SCAN_SYSTEM = `You are a security reviewer for a solo developer. You get a repo file list, automated secret pattern hits and the contents of the most security relevant files. Report real issues only, no padding: leaked or hardcoded credentials, secrets that would ship to a browser bundle (e.g. VITE_ or REACT_APP_ prefixed keys), missing gitignore coverage for env files, weak or default fallback secrets, wide open CORS, injection risks, auth mistakes. For each finding give severity critical, high, medium or low, the file, a one line issue and a one line concrete fix. If the repo looks clean say so plainly in the summary. No hyphens, no Oxford commas.

Return ONLY raw JSON: {"summary":"2 or 3 sentences","findings":[{"severity":"critical","file":"...","issue":"...","fix":"..."}]}`;

router.post('/scan-repo', requireAuth, async (req, res) => {
  const repo = String((req.body || {}).repo || '').trim();
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) return res.status(400).json({ error: 'Give the repo as owner/name, e.g. fechinmitchell/FMSoftware.' });
  const ghToken = process.env.GITHUB_TOKEN;
  try {
    const meta = await gh(`/repos/${repo}`, ghToken);
    const branch = meta.default_branch || 'main';
    const tree = await gh(`/repos/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`, ghToken);
    const all = (tree.tree || []).filter((t) => t.type === 'blob');
    const candidates = all.filter((t) => !SKIP_DIRS.test(t.path) && !SKIP_FILES.test(t.path) && TEXT_FILE.test(t.path) && (t.size || 0) < 150000);
    const files = candidates.slice(0, 80);

    const hits = [];
    const contents = [];
    for (const f of files) {
      try {
        const blob = await gh(`/repos/${repo}/git/blobs/${f.sha}`, ghToken);
        const text = Buffer.from(blob.content || '', 'base64').toString('utf8');
        contents.push({ path: f.path, text });
        text.split('\n').forEach((line, i) => {
          SECRET_PATTERNS.forEach(([label, re]) => {
            if (re.test(line)) hits.push({ file: f.path, line: i + 1, type: label, snippet: line.trim().slice(0, 90) });
          });
        });
      } catch {}
    }

    // hand the LLM the riskiest files: anything with a hit, plus config/auth/env-ish files
    const risky = contents
      .map((c) => ({ ...c, score: (hits.some((h) => h.file === c.path) ? 5 : 0) + (/env|config|auth|secret|key|server|api|vercel|docker|gitignore/i.test(c.path) ? 2 : 0) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 14);
    const prompt =
      `REPO: ${repo} (default branch ${branch})\n\n` +
      `TEXT FILES (${candidates.length} of ${all.length} total):\n${candidates.slice(0, 200).map((f) => f.path).join('\n')}\n\n` +
      `AUTOMATED SECRET PATTERN HITS (${hits.length}):\n${hits.slice(0, 40).map((h) => `${h.file}:${h.line} [${h.type}] ${h.snippet}`).join('\n') || '(none)'}\n\n` +
      `KEY FILES:\n${risky.map((c) => `===== ${c.path} =====\n${c.text.slice(0, 3000)}`).join('\n\n')}`;
    const out = await claude({ system: SCAN_SYSTEM, prompt, model: SONNET, maxTokens: 1800 });
    let report;
    try { report = parseJson(out.text); } catch { report = { summary: out.text.slice(0, 600), findings: [] }; }
    res.json({
      repo, branch, filesScanned: files.length, totalFiles: all.length,
      regexHits: hits.slice(0, 60),
      summary: report.summary || '',
      findings: Array.isArray(report.findings) ? report.findings : [],
      costUSD: out.costUSD,
    });
  } catch (err) {
    console.error('scan error:', err);
    const hint = /404/.test(err.message) ? ' (private repo? GITHUB_TOKEN must have access to it)' : '';
    res.status(502).json({ error: 'Scan failed: ' + err.message + hint });
  }
});

/* ---------------- blog/publish: commit markdown to GitHub ---------------- */
// Needs env: GITHUB_TOKEN (fine-grained, contents:write on the repo),
//            GITHUB_REPO ("owner/repo"), optional GITHUB_BRANCH (default main)
router.post('/blog/publish', requireAuth, async (req, res) => {
  const { slug = '', title = '', markdown = '' } = req.body || {};
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || 'main';
  if (!token || !repo) return res.status(500).json({ error: 'Set GITHUB_TOKEN and GITHUB_REPO on the server to publish.' });
  const safeSlug = String(slug || title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (!safeSlug || !markdown.trim()) return res.status(400).json({ error: 'Post needs a slug and a body.' });
  const path = `client/blog/${safeSlug}.md`;
  const api = `https://api.github.com/repos/${repo}/contents/${path}`;
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'fmsoftware-hq' };
  try {
    let sha;
    const existing = await fetch(`${api}?ref=${branch}`, { headers });
    if (existing.ok) sha = (await existing.json()).sha;
    const r = await fetch(api, {
      method: 'PUT', headers,
      body: JSON.stringify({
        message: `blog: ${title || safeSlug}`,
        content: Buffer.from(markdown, 'utf8').toString('base64'),
        branch, ...(sha ? { sha } : {}),
      }),
    });
    if (!r.ok) throw new Error((await r.text()).slice(0, 200));
    const data = await r.json();
    res.json({ ok: true, path, url: data.commit && data.commit.html_url, live: `https://fmsoftware.ie/blog/${safeSlug}/` });
  } catch (err) {
    console.error('publish error:', err);
    res.status(502).json({ error: 'GitHub publish failed: ' + err.message });
  }
});

module.exports = router;