// ------------------------------------------------------------------
//  Agent HQ — shared state engine.
//  One data model, any number of theme renderers on top.
//  Everything persists to localStorage; the server stays stateless
//  except for LLM helpers and blog publishing.
// ------------------------------------------------------------------
import { useState, useEffect, useCallback, useRef } from 'react';

const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const KEY = 'fm_hq_v1';
export const THEME_KEY = 'fm_hq_theme';
const PROFILE_KEY = 'fm_profile'; // shared with Mission Control (HAL.md)

export const MODELS = [
  { id: 'auto', label: 'Auto · Kensei picks' },
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5' },
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6' },
  { id: 'claude-opus-4-8', label: 'Opus 4.8' },
];
export function modelLabel(id) {
  if (!id || id === 'auto') return 'Auto';
  const m = MODELS.find((m) => m.id === id);
  return m ? m.label.split(' ')[0] : id.split('-')[1] || id;
}

export const uid = () => Math.random().toString(36).slice(2, 9);
const now = () => Date.now();

/* ------------------------------------------------------------------ */
/*  Seed agents                                                        */
/* ------------------------------------------------------------------ */
const BLOG_ROLE = 'You write SEO blog posts for fmsoftware.ie, the site of FM Software, a one person software, automation and AI studio in Galway Ireland run by Fechín Mitchell. Posts target commercial searches like custom software Ireland, workflow automation for law firms, AI tools for SMEs. Before writing you research the topic: find two or three popular well written blogs or articles on it, study how they hook the reader, structure the piece and keep momentum, then borrow the craft but never the words. You write like a sharp human, not an AI. Hard style rules: no em dashes or long hyphens anywhere, use a full stop and a new sentence instead. No Oxford commas. Prefer short sentences over comma chains. Never use filler like "in today\'s fast paced world", "delve", "unlock", "game changer", "seamless" or "cutting edge". Every post must contain real riveting data: at least three specific numbers, statistics or facts found in your research, each linked to its source. You only use real proof from the profile. You never invent clients, case studies, metrics or testimonials.';

const BLOG_TASK = 'Write one blog post of 800 to 1200 words on a topic that would attract Irish businesses, law firms or public sector buyers searching for software or automation help. First research the topic and read how two or three popular blogs cover it, and pull three or more concrete statistics with sources. Start the output with EXACTLY this frontmatter block then the markdown body:\n---\ntitle: <post title>\nslug: <kebab-case-slug>\ndescription: <150 char meta description>\n---\nOpen with a hook a busy business owner would actually keep reading. Use plain headings, short paragraphs and one concrete example or number per section, with source links inline. End with a short call to action pointing at fmsoftware.ie/#contact, then sign off on its own final line exactly as: FMSoftware - Kaizen AI Agent';

const SEC_ROLE = 'You are a repo security scanner. You fetch a GitHub repo, check every text file for leaked credentials with pattern matching, then review the most security relevant files for weak secrets, exposed keys, open CORS and auth mistakes. You report only real issues with a concrete fix for each.';
const SEC_TASK = 'Scan the target repo for leaked API keys and security issues. Report findings by severity with a concrete fix for each.';

function seedAgents() {
  return [
    {
      id: 'find_clients', emoji: '🔍', name: 'Find Clients', kind: 'general',
      webSearch: true, model: 'auto', current: 1, kaizen: '', runs: [],
      versions: [{
        v: 1, at: now(), note: 'first version',
        role: 'You are a lead researcher for FM Software. You find real organisations that fit the ideal client profile and look like they need the work, then hand back a tight shortlist with evidence.',
        task: 'Find 8 organisations in Ireland or remote friendly markets that plausibly need custom software, automation or AI work a one person studio could deliver. For each give the name, one line on why they fit, a recent signal they might need help, and a link. Prioritise ones I could realistically win. No filler.',
      }],
    },
    {
      id: 'blog_writer', emoji: '✍️', name: 'Blog Writer', kind: 'blog',
      webSearch: true, model: 'auto', current: 1, kaizen: '', runs: [],
      publishMode: 'draft',
      versions: [{ v: 1, at: now(), note: 'first version', role: BLOG_ROLE, task: BLOG_TASK }],
    },
    {
      id: 'security_scanner', emoji: '🛡️', name: 'Security Scanner', kind: 'security',
      webSearch: false, model: 'auto', current: 1, kaizen: '', runs: [],
      target: 'fechinmitchell/FMSoftware',
      versions: [{ v: 1, at: now(), note: 'first version', role: SEC_ROLE, task: SEC_TASK }],
    },
  ];
}

function defaultState() {
  return {
    agents: seedAgents(),
    approvals: [],           // {id, agentId, agentName, kind, title, body, meta, status, at, note, url}
    masterKaizen: '',        // the master agent's own lessons: routing + when to ask
    totalCost: 0,            // all-time, every model call
    costByDay: {},           // {'2026-08-12': 0.42, ...} — powers today/week/month/year
    library: [],             // saved outputs, analysed into action plans
  };
}

/* one-off migrations for already-saved state */
function migrate(s) {
  // 2026-08-12: research-first blog style + FMSoftware sign-off, delivered as a NEW version (v1 stays for rollback)
  const bw = s.agents.find((a) => a.id === 'blog_writer');
  if (bw && Array.isArray(bw.versions) && !bw.versions.some((v) => v.note === 'style + sign-off update')) {
    const nextV = Math.max(...bw.versions.map((v) => v.v)) + 1;
    bw.versions = [...bw.versions, { v: nextV, at: Date.now(), note: 'style + sign-off update', role: BLOG_ROLE, task: BLOG_TASK }];
    bw.current = nextV;
  }
  // 2026-08-12: seed the Security Scanner for existing installs
  if (!s.agents.some((a) => a.kind === 'security')) {
    s.agents = [...s.agents, {
      id: 'security_scanner', emoji: '🛡️', name: 'Security Scanner', kind: 'security',
      webSearch: false, model: 'auto', current: 1, kaizen: '', runs: [],
      target: 'fechinmitchell/FMSoftware',
      versions: [{ v: 1, at: Date.now(), note: 'first version', role: SEC_ROLE, task: SEC_TASK }],
    }];
  }
  return s;
}

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && Array.isArray(s.agents)) return migrate({ ...defaultState(), ...s, costByDay: s.costByDay || {} });
  } catch {}
  return defaultState();
}

const dayKey = (d = new Date()) => d.toLocaleDateString('en-CA'); // YYYY-MM-DD, local time

/* ------------------------------------------------------------------ */
/*  API helpers                                                        */
/* ------------------------------------------------------------------ */
async function post(path, token, body) {
  const r = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body || {}),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `Request failed (${r.status})`);
  return data;
}

/* Fallback model routing when the server route call fails.
   Same logic the master uses as its floor. */
export function heuristicRoute(agent, version) {
  const t = `${version.role || ''} ${version.task || ''}`.toLowerCase();
  if (/strateg|architec|complex|multi step|hard reasoning|plan the/.test(t))
    return { model: 'claude-opus-4-8', reason: 'heuristic: hard reasoning' };
  if (agent.webSearch) return { model: 'claude-sonnet-4-6', reason: 'heuristic: web research' };
  if ((version.task || '').length < 220 && /list|classif|extract|summar|short|tags/.test(t))
    return { model: 'claude-haiku-4-5-20251001', reason: 'heuristic: simple task' };
  return { model: 'claude-sonnet-4-6', reason: 'heuristic: default drafting' };
}

/* Parse the blog agent's frontmatter block */
export function parseBlogPost(text) {
  const m = String(text || '').match(/---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)/);
  if (!m) return null;
  const head = {};
  m[1].split('\n').forEach((line) => {
    const i = line.indexOf(':');
    if (i > 0) head[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
  });
  if (!head.title) return null;
  const slug = (head.slug || head.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return { title: head.title, slug, description: head.description || '', markdown: m[2].trim(), full: text };
}

/* ------------------------------------------------------------------ */
/*  The hook                                                           */
/* ------------------------------------------------------------------ */
export default function useHqStore(token) {
  const [state, setState] = useState(load);
  const [theme, setThemeState] = useState(() => localStorage.getItem(THEME_KEY) || 'office');
  const [busyIds, setBusyIds] = useState(() => new Set());
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} }, [state]);

  const setTheme = useCallback((t) => { setThemeState(t); localStorage.setItem(THEME_KEY, t); }, []);
  const profile = () => localStorage.getItem(PROFILE_KEY) || '';

  /* every model call, everywhere, lands in the ledger */
  const addCost = useCallback((usd, agentId) => {
    if (!usd) return;
    setState((s) => {
      const day = dayKey();
      const costByDay = { ...s.costByDay, [day]: (s.costByDay?.[day] || 0) + usd };
      const keys = Object.keys(costByDay).sort();
      while (keys.length > 400) delete costByDay[keys.shift()]; // keep ~13 months of days
      return {
        ...s,
        totalCost: s.totalCost + usd,
        costByDay,
        agents: agentId ? s.agents.map((a) => (a.id === agentId ? { ...a, costTotal: (a.costTotal || 0) + usd } : a)) : s.agents,
      };
    });
  }, []);

  const patchAgent = useCallback((id, patch) => {
    setState((s) => ({ ...s, agents: s.agents.map((a) => (a.id === id ? { ...a, ...(typeof patch === 'function' ? patch(a) : patch) } : a)) }));
  }, []);
  const setBusy = (id, on) => setBusyIds((prev) => { const n = new Set(prev); on ? n.add(id) : n.delete(id); return n; });

  const appendKaizen = useCallback((id, lines) => {
    if (!lines || !lines.trim()) return;
    patchAgent(id, (a) => ({ kaizen: `${a.kaizen ? a.kaizen + '\n' : ''}${lines.trim()}`.split('\n').slice(-30).join('\n') }));
  }, [patchAgent]);

  const appendMasterKaizen = useCallback((line) => {
    if (!line || !line.trim()) return;
    setState((s) => ({ ...s, masterKaizen: `${s.masterKaizen ? s.masterKaizen + '\n' : ''}${line.trim()}`.split('\n').slice(-40).join('\n') }));
  }, []);

  /* ---------------- run: the core loop ---------------- */
  const runAgent = useCallback(async (id) => {
    const agent = stateRef.current.agents.find((a) => a.id === id);
    if (!agent || busyIds.has(id)) return;
    const version = agent.versions.find((v) => v.v === agent.current) || agent.versions[agent.versions.length - 1];
    setBusy(id, true);
    const started = now();

    // security agents don't prompt a model directly — they drive the repo scanner
    if (agent.kind === 'security') {
      let run;
      try {
        const target = (agent.target || '').trim();
        if (!target) throw new Error('Set a target repo (owner/name) in the agent editor first.');
        const r = await post('/api/admin/hq/scan-repo', token, { repo: target });
        const sevOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        const fx = [...(r.findings || [])].sort((a, b) => (sevOrder[a.severity] ?? 9) - (sevOrder[b.severity] ?? 9));
        const output = [
          `SECURITY SCAN — ${r.repo} (${r.branch})`,
          '', r.summary, '',
          ...(fx.length ? fx.map((f) => `[${(f.severity || 'info').toUpperCase()}] ${f.file}\n  issue: ${f.issue}\n  fix: ${f.fix}`) : ['No findings. Clean scan.']),
          '',
          `Secret pattern hits: ${(r.regexHits || []).length}` +
            ((r.regexHits || []).length ? '\n' + r.regexHits.slice(0, 15).map((h) => `  ${h.file}:${h.line} [${h.type}]`).join('\n') : ''),
          `Scanned ${r.filesScanned} of ${r.totalFiles} files.`,
        ].join('\n');
        run = { id: uid(), at: started, ms: now() - started, v: version.v, model: 'scanner', reason: 'security scan', costUSD: r.costUSD || 0, output, sources: [], error: '' };
      } catch (err) {
        run = { id: uid(), at: started, ms: now() - started, v: version.v, model: 'scanner', reason: 'security scan', costUSD: 0, output: '', sources: [], error: err.message };
      }
      patchAgent(id, (a) => ({ runs: [...a.runs, run].slice(-25) }));
      addCost(run.costUSD || 0, id);
      setBusy(id, false);
      return run;
    }

    // 1. the Kensei picks the model (unless pinned)
    let route = { model: agent.model, reason: 'pinned by you' };
    if (!agent.model || agent.model === 'auto') {
      try {
        route = await post('/api/admin/hq/route', token, {
          name: agent.name, role: version.role, task: version.task,
          webSearch: agent.webSearch, masterKaizen: stateRef.current.masterKaizen,
          history: agent.runs.slice(-5).map((r) => ({ model: r.model, ok: !r.error, cost: r.costUSD })),
        });
      } catch { route = heuristicRoute(agent, version); }
    }

    // 2. run the agent (kaizen lessons ride along in the role, unless learning is off)
    const roleWithKaizen = agent.learn !== false && agent.kaizen
      ? `${version.role}\n\nLessons you have learned from past runs. Follow them:\n${agent.kaizen}`
      : version.role;
    let run;
    try {
      const out = await post('/api/admin/workflow/agent/run', token, {
        role: roleWithKaizen, task: version.task, profile: profile(),
        model: route.model, webSearch: agent.webSearch,
        goal: 'Win new clients and grow recurring revenue for FM Software',
      });
      run = {
        id: uid(), at: started, ms: now() - started, v: version.v,
        model: out.model || route.model, reason: route.reason,
        costUSD: out.costUSD || 0, output: out.text || '', sources: out.sources || [],
        error: out.skipped ? `skipped (${out.reason})` : '',
      };
    } catch (err) {
      run = { id: uid(), at: started, ms: now() - started, v: version.v, model: route.model, reason: route.reason, costUSD: 0, output: '', sources: [], error: err.message };
    }
    patchAgent(id, (a) => ({ runs: [...a.runs, run].slice(-25) }));
    addCost((run.costUSD || 0) + (route.costUSD || 0), id);
    setBusy(id, false);

    // 3. blog agents: route the post into approvals or straight to publish
    if (!run.error && agent.kind === 'blog' && run.output) {
      const p = parseBlogPost(run.output);
      const item = {
        id: uid(), agentId: id, agentName: agent.name, kind: 'blogPost', at: now(), status: 'pending',
        title: p ? p.title : `Post from ${agent.name}`,
        body: p ? p.full : run.output, meta: p ? { slug: p.slug, description: p.description } : {},
      };
      if (agent.publishMode === 'auto' && p) {
        publishBlog(item).catch((err) => {
          // auto publish failed — surface it in approvals instead of losing the post
          setState((s) => ({ ...s, approvals: [{ ...item, status: 'error', note: err.message }, ...s.approvals] }));
        });
      } else {
        setState((s) => ({ ...s, approvals: [item, ...s.approvals] }));
      }
    }

    // 4. self improvement: pull a lesson out of the run (cheap, fire and forget)
    if (!run.error && run.output && agent.learn !== false) {
      post('/api/admin/hq/kaizen', token, {
        name: agent.name, role: version.role, task: version.task,
        output: run.output.slice(0, 4000),
      }).then((r) => { appendKaizen(id, r.lessons); addCost(r.costUSD || 0, id); }).catch(() => {});
    }
    return run;
  }, [token, busyIds, patchAgent, appendKaizen, addCost]);

  /* ---------------- versioning ---------------- */
  const newVersion = useCallback(async (id, critique) => {
    const agent = stateRef.current.agents.find((a) => a.id === id);
    if (!agent) return;
    const version = agent.versions.find((v) => v.v === agent.current) || agent.versions[agent.versions.length - 1];
    const lastRun = [...agent.runs].reverse().find((r) => !r.error);
    const r = await post('/api/admin/hq/improve', token, {
      role: version.role, task: version.task, kaizen: agent.kaizen,
      lastOutput: lastRun ? lastRun.output.slice(0, 4000) : '',
      critique: critique || '',
    });
    const nextV = Math.max(...agent.versions.map((v) => v.v)) + 1;
    const created = { v: nextV, at: now(), role: r.role, task: r.task, note: r.note || (critique ? 'from your critique' : 'self improved') };
    patchAgent(id, (a) => ({ versions: [...a.versions, created], current: nextV }));
    addCost(r.costUSD || 0, id);
    return created;
  }, [token, patchAgent, addCost]);

  const rollbackTo = useCallback((id, v) => patchAgent(id, { current: v }), [patchAgent]);

  /* ---------------- create / edit / delete ---------------- */
  /* Ask the Kensei to draft agent fields from a few words (no agent added yet) */
  const draftAgent = useCallback(async (description) => {
    const r = await post('/api/admin/hq/build', token, { description, profile: profile() });
    if (!MODELS.some((m) => m.id === r.model)) r.model = 'auto';
    addCost(r.costUSD || 0);
    return r; // {name, emoji, role, task, webSearch, model}
  }, [token, addCost]);

  /* 💡 new-agent ideas: from the current team, the business, and community patterns */
  const fetchIdeas = useCallback(async () => {
    const s = stateRef.current;
    const r = await post('/api/admin/hq/ideas', token, {
      profile: profile(),
      agents: s.agents.map((a) => {
        const v = a.versions.find((x) => x.v === a.current) || a.versions[a.versions.length - 1] || {};
        return { name: a.name, role: v.role || '' };
      }),
      masterKaizen: s.masterKaizen,
    });
    addCost(r.costUSD || 0);
    return r; // {ideas: [{title, pitch, angle}], costUSD}
  }, [token, addCost]);

  /* Add a fully-specified agent to the board (the wizard's Accept step) */
  const addAgent = useCallback((fields) => {
    const agent = {
      id: uid(), emoji: fields.emoji || '🤖', name: fields.name || 'New Agent',
      kind: fields.kind || 'general', webSearch: !!fields.webSearch,
      model: fields.model || 'auto', learn: fields.learn !== false,
      target: fields.target || '',
      current: 1, kaizen: '', runs: [], publishMode: fields.publishMode || 'draft',
      versions: [{ v: 1, at: now(), role: fields.role || '', task: fields.task || '', note: 'first version' }],
    };
    setState((s) => ({ ...s, agents: [...s.agents, agent] }));
    return agent.id;
  }, []);

  const createAgent = useCallback(async (description) => {
    let fields = { name: 'New Agent', emoji: '🤖', role: '', task: '', model: 'auto', webSearch: false };
    if (description && description.trim()) {
      const r = await post('/api/admin/hq/build', token, { description, profile: profile() });
      fields = { ...fields, ...r };
      if (!MODELS.some((m) => m.id === fields.model)) fields.model = 'auto';
    }
    const agent = {
      id: uid(), emoji: fields.emoji, name: fields.name,
      kind: /blog|seo|post|article/i.test(description || '') ? 'blog' : 'general',
      webSearch: !!fields.webSearch, model: fields.model || 'auto',
      current: 1, kaizen: '', runs: [], publishMode: 'draft',
      versions: [{ v: 1, at: now(), role: fields.role, task: fields.task, note: 'first version' }],
    };
    setState((s) => ({ ...s, agents: [...s.agents, agent] }));
    return agent.id;
  }, [token]);

  const saveAgentMeta = useCallback((id, meta, versionPatch) => {
    patchAgent(id, (a) => {
      const next = { ...a, ...meta };
      if (versionPatch) {
        next.versions = a.versions.map((v) => (v.v === a.current ? { ...v, ...versionPatch } : v));
      }
      return next;
    });
  }, [patchAgent]);

  const deleteAgent = useCallback((id) => {
    setState((s) => ({ ...s, agents: s.agents.filter((a) => a.id !== id), approvals: s.approvals.filter((x) => x.agentId !== id) }));
  }, []);

  /* ---------------- library: save output → analysed action plan ---------------- */
  const saveOutput = useCallback(async (agentId, runId) => {
    const agent = stateRef.current.agents.find((a) => a.id === agentId);
    if (!agent) return;
    const run = agent.runs.find((r) => r.id === runId) || agent.runs[agent.runs.length - 1];
    if (!run || !run.output) return;
    if ((stateRef.current.library || []).some((x) => x.runId === run.id)) return; // no duplicates
    const item = {
      id: uid(), at: now(), agentId, agentName: agent.name, emoji: agent.emoji, runId: run.id,
      title: `${agent.name} output`, summary: '', steps: null, // null = analysing
      output: run.output, sources: run.sources || [],
    };
    setState((s) => ({ ...s, library: [item, ...(s.library || [])].slice(0, 100) }));
    try {
      const r = await post('/api/admin/hq/analyse', token, { output: run.output, agentName: agent.name, profile: profile() });
      addCost(r.costUSD || 0, agentId);
      setState((s) => ({
        ...s,
        library: s.library.map((x) => (x.id === item.id
          ? { ...x, title: r.title || x.title, summary: r.summary || '', steps: (r.steps || []).map((t) => ({ text: t, done: false })) }
          : x)),
      }));
    } catch (err) {
      setState((s) => ({ ...s, library: s.library.map((x) => (x.id === item.id ? { ...x, summary: 'Analysis failed: ' + err.message, steps: [] } : x)) }));
    }
    return item.id;
  }, [token, addCost]);

  const toggleStep = useCallback((itemId, idx) => {
    setState((s) => ({ ...s, library: s.library.map((x) => (x.id === itemId ? { ...x, steps: x.steps.map((st, i) => (i === idx ? { ...st, done: !st.done } : st)) } : x)) }));
  }, []);

  const deleteSaved = useCallback((itemId) => {
    setState((s) => ({ ...s, library: s.library.filter((x) => x.id !== itemId) }));
  }, []);

  /* ---------------- approvals ---------------- */
  const publishBlog = useCallback(async (item) => {
    const p = parseBlogPost(item.body) || { slug: item.meta?.slug, title: item.title, markdown: item.body };
    const r = await post('/api/admin/hq/blog/publish', token, {
      slug: p.slug, title: p.title, markdown: item.body,
    });
    setState((s) => ({
      ...s,
      approvals: [
        { ...item, status: 'published', url: r.url },
        ...s.approvals.filter((x) => x.id !== item.id),
      ],
    }));
    return r;
  }, [token]);

  const approve = useCallback(async (itemId) => {
    const item = stateRef.current.approvals.find((x) => x.id === itemId);
    if (!item) return;
    appendMasterKaizen(`approved: ${item.kind} "${item.title}" — this category tends to be fine`);
    if (item.kind === 'blogPost') {
      try { await publishBlog(item); }
      catch (err) {
        setState((s) => ({ ...s, approvals: s.approvals.map((x) => (x.id === itemId ? { ...x, status: 'error', note: err.message } : x)) }));
        throw err;
      }
    } else {
      setState((s) => ({ ...s, approvals: s.approvals.map((x) => (x.id === itemId ? { ...x, status: 'approved' } : x)) }));
    }
  }, [appendMasterKaizen, publishBlog]);

  const reject = useCallback((itemId, note) => {
    const item = stateRef.current.approvals.find((x) => x.id === itemId);
    if (!item) return;
    setState((s) => ({ ...s, approvals: s.approvals.map((x) => (x.id === itemId ? { ...x, status: 'rejected', note } : x)) }));
    appendMasterKaizen(`rejected: ${item.kind} "${item.title}"${note ? ` — ${note}` : ''}`);
    if (note) appendKaizen(item.agentId, `the boss rejected "${item.title}": ${note}`);
  }, [appendMasterKaizen, appendKaizen]);

  /* ---------------- derived view model for themes ---------------- */
  const viewAgents = state.agents.map((a) => {
    const lastRun = a.runs[a.runs.length - 1];
    return {
      id: a.id, emoji: a.emoji, name: a.name, kind: a.kind,
      status: busyIds.has(a.id) ? 'running' : (lastRun && !lastRun.error ? 'ready' : 'idle'),
      version: a.current, model: modelLabel(lastRun ? lastRun.model : a.model),
      runCount: a.runs.length, lessons: a.kaizen ? a.kaizen.split('\n').length : 0,
      costTotal: a.costTotal || 0,
    };
  });

  /* cost windows, computed from the day ledger */
  const costs = (() => {
    const cbd = state.costByDay || {};
    const sumSince = (since) => Object.entries(cbd).reduce((t, [k, v]) => (k >= since ? t + v : t), 0);
    const d = new Date();
    const monday = new Date(d); monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return {
      today: sumSince(dayKey(d)),
      week: sumSince(dayKey(monday)),
      month: sumSince(dayKey(new Date(d.getFullYear(), d.getMonth(), 1))),
      year: sumSince(dayKey(new Date(d.getFullYear(), 0, 1))),
      all: state.totalCost,
    };
  })();
  const pendingApprovals = state.approvals.filter((x) => x.status === 'pending');
  const recentRuns = state.agents
    .flatMap((a) => a.runs.map((r) => ({ ...r, agentName: a.name, agentId: a.id })))
    .sort((x, y) => y.at - x.at).slice(0, 4);

  return {
    state, theme, setTheme, busyIds, viewAgents, pendingApprovals, recentRuns, costs,
    runAgent, newVersion, rollbackTo, createAgent, draftAgent, addAgent, fetchIdeas, saveAgentMeta, deleteAgent,
    saveOutput, toggleStep, deleteSaved,
    approve, reject, appendMasterKaizen,
  };
}