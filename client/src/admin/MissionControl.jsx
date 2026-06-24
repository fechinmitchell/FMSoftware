import { useState, useEffect, useRef } from 'react';
import AgentOffice from './AgentOffice';

function fmtMs(ms) {
  if (ms == null) return '';
  const s = ms / 1000;
  if (s < 1) return Math.round(ms) + 'ms';
  if (s < 10) return s.toFixed(1) + 's';
  if (s < 60) return Math.round(s) + 's';
  const m = Math.floor(s / 60), r = Math.round(s % 60);
  return m + 'm' + (r ? ' ' + r + 's' : '');
}

function fmtWhen(ts) {
  if (!ts) return '';
  const d = new Date(ts), now = new Date();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return 'Today ' + time;
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Yesterday ' + time;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + time;
}

const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const ACTIVE_KEY = 'fm_mission';
const SAVED_KEY = 'fm_missions';
const PROFILE_KEY = 'fm_profile';
const TOTAL_KEY = 'fm_total_cost';

const MODELS = [
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5' },
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6' },
  { id: 'claude-opus-4-8', label: 'Opus 4.8' },
];

const DEFAULT_PROFILE = `# HAL.md

## Identity
I run FM Software, a one person studio in Galway Ireland. I build production web software for professional services firms. MSc in Software Engineering. I ship fast as a contractor, days to start, weeks to deliver.

## Voice
Direct, plain, confident. No hyphens, no Oxford commas. Short sentences. Specific over vague. Lead with proof not adjectives.

## Proof
Client portal for a US law firm. A psychotherapy practice site. Scorelect, a GAA scoring platform. React and Node, AI automation and integrations.

## Niches
Law firms, financial and compliance firms, psychotherapy and clinics, sports platforms. Document heavy work and manual workflows are the sweet spot.

## Offer
Fixed scope builds and retainers. Rate moving toward 75 to 90 euro an hour. Goal is location independent recurring income.

## What works
(this grows as I critique missions and teach the system)`;
const SOUL_TEMPLATE = DEFAULT_PROFILE;

const money = (n) => '$' + (n || 0).toFixed(2);
const uid = () => Math.random().toString(36).slice(2, 8);
const handleOf = (name, id) => (name || '').replace(/[^A-Za-z0-9]/g, '') || ('agent' + id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DAILY_ANALYST_Q = 'Pull everything the team produced into one clear, prioritized plan I can act on today. Lead with the single most important next action, then the rest in order. Be specific and concise. No preamble.';
const CRITIQUE_Q = 'Critique these results honestly and specifically. What was weak, generic, off target or low quality, and what should the team do differently next time? Give it as a short list of concrete improvements.';
const resultsBlob = (agents) => agents.filter((a) => a.result && !String(a.result).startsWith('Error')).map((a) => `### ${a.name}\n${a.result}`).join('\n\n');

const AGENT_LIBRARY = [
  { emoji: '🔍', name: 'Lead Scout', model: 'claude-sonnet-4-6', webSearch: true,
    role: 'You are a lead researcher. You find real organisations that fit an ideal client profile and look like they need the work, then hand back a tight shortlist with evidence.',
    task: 'Find 8 organisations that fit the mission goal and my profile. For each give the name, one line on why they fit, a recent signal they might need help, and a link. Prioritise ones I could realistically win. No filler.' },
  { emoji: '🏢', name: 'Company Researcher', model: 'claude-sonnet-4-6', webSearch: true,
    role: 'You are a company analyst. You deep dive a single organisation and surface what matters for winning them as a client.',
    task: 'Research the most promising target the team has surfaced so far, or one named in the goal. Cover what they do, their likely tech setup, recent news, who the decision makers are, and the specific pain I could solve. Finish with the angle I should lead with.' },
  { emoji: '🕵', name: 'Decision Maker Finder', model: 'claude-sonnet-4-6', webSearch: true,
    role: 'You find the right human to contact at a target organisation and how to reach them.',
    task: 'For the named targets, identify the person who would own this decision. Give their role, name if public, and the best contact route. Say plainly when a name is not public rather than guessing.' },
  { emoji: '✍', name: 'Outreach Writer', model: 'claude-sonnet-4-6', webSearch: false,
    role: 'You write cold outreach in my voice that gets replies. Short, specific, no fluff, no hype.',
    task: 'Write a tailored cold email and a shorter LinkedIn message for the top target. Reference something specific about them, tie it to my proof, and end with one low friction ask. Keep it in my voice.' },
  { emoji: '💸', name: 'Pricing and Scoping', model: 'claude-sonnet-4-6', webSearch: false,
    role: 'You turn a vague need into a scoped project with a realistic price range I can quote.',
    task: 'For the top opportunity, outline a tight project scope, a phased build, and a price range in euros with the reasoning. Flag what would push it up or down. Keep it to something I can paste into a proposal.' },
  { emoji: '🧭', name: 'Competitor Mapper', model: 'claude-sonnet-4-6', webSearch: true,
    role: 'You map who else serves this niche and how I stand apart.',
    task: 'Map the main alternatives a prospect in this niche would consider, including agencies and freelancers. For each note their angle and price tier, then give me the two or three lines of differentiation I should use.' },
  { emoji: '🧩', name: 'Portfolio Matcher', model: 'claude-sonnet-4-6', webSearch: false,
    role: 'You match my past work to a prospect so the pitch feels proven, not generic.',
    task: 'Using my profile and past projects, pick the one or two most relevant case studies for the top target and write the one line proof I should drop into outreach for each.' },
  { emoji: '🔁', name: 'Follow-up Writer', model: 'claude-haiku-4-5-20251001', webSearch: false,
    role: 'You write follow up messages for people who did not reply, without being annoying.',
    task: 'Write a two step follow up sequence for a non responder: a short nudge, then a final value add break up message. Keep each in my voice and under five lines.' },
  { emoji: '🎯', name: 'Job Board Hunter', model: 'claude-sonnet-4-6', webSearch: true,
    role: 'You scan for live contract and freelance opportunities that fit me.',
    task: 'Find current postings or public signals where someone wants the kind of build I do, relevant to the goal. For each give what they want, why I fit, the link, and how fresh it is.' },
  { emoji: '📊', name: 'Market Researcher', model: 'claude-sonnet-4-6', webSearch: true,
    role: 'You read a sector for demand signals so I aim at niches that are actually buying.',
    task: 'Survey the niche in the goal for demand signals: who is hiring or spending, what problems keep coming up, and where budget is moving. Finish with the two segments I should focus on and why.' },
];

function blankAgent() {
  return { id: uid(), emoji: '🤖', name: 'New Agent', role: 'You are a specialist. Describe what you do and how it moves the goal forward.', model: 'claude-sonnet-4-6', webSearch: false, enabled: true, task: '', result: '', sources: [], cost: 0, busy: false, officeSeed: 0 };
}
function defaultMission() {
  return { id: uid(), goal: 'Get 5 new clients in the next month', model: 'claude-sonnet-4-6', summary: '', agents: [], cost: 0, budget: 0 };
}
function loadActive() {
  try { const m = JSON.parse(localStorage.getItem(ACTIVE_KEY)); return m && Array.isArray(m.agents) ? m : defaultMission(); } catch { return defaultMission(); }
}
function loadSaved() {
  try { return JSON.parse(localStorage.getItem(SAVED_KEY) || '[]'); } catch { return []; }
}

const QUICK_ASKS = [
  'Synthesise all of this into a one page action plan',
  'Which 10 leads should I contact first and why',
  'Turn this into a prioritised checklist for this week',
];

export default function MissionControl({ token }) {
  const [profile, setProfile] = useState(() => localStorage.getItem(PROFILE_KEY) || DEFAULT_PROFILE);
  const [showProfile, setShowProfile] = useState(false);
  const [mission, setMission] = useState(loadActive);
  const [saved, setSaved] = useState(loadSaved);
  const [showSaved, setShowSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [runningAll, setRunningAll] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [viewing, setViewing] = useState(null); // {name, text}
  const [analyst, setAnalyst] = useState({ question: '', model: 'claude-sonnet-4-6', webSearch: false, result: '', sources: [], busy: false, cost: 0 });
  const [totalCost, setTotalCost] = useState(() => { const v = parseFloat(localStorage.getItem(TOTAL_KEY)); return isNaN(v) ? 0 : v; });
  const [compiling, setCompiling] = useState(false);
  const [outboxErr, setOutboxErr] = useState('');
  const [critique, setCritique] = useState('');
  const [learning, setLearning] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [soulPreview, setSoulPreview] = useState(null);
  const [openAnalyst, setOpenAnalyst] = useState(false);
  const [openDeliver, setOpenDeliver] = useState(false);
  const [openLearn, setOpenLearn] = useState(false);
  const stopRef = useRef(false);
  const controllersRef = useRef({});
  const abortedRef = useRef(new Set());
  const [generatingGoals, setGeneratingGoals] = useState(false);
  const [goalIdeas, setGoalIdeas] = useState([]);
  const [pitchSteer, setPitchSteer] = useState('');
  const [autoRun, setAutoRun] = useState(null);        // live pipeline run for one saved mission
  const [autoLearn, setAutoLearn] = useState(true);    // auto-update HAL after each run
  const [resultsView, setResultsView] = useState(null);// saved mission id whose history modal is open
  const [openRun, setOpenRun] = useState(null);        // selected run id within history ('live' for the in-progress run)
  const [expandedSaved, setExpandedSaved] = useState(null);
  const autoStopRef = useRef(false);
  const autoPauseRef = useRef(false);
  const autoCtrlRef = useRef(null);
  const [asks, setAsks] = useState([]);
  const [suggestingAsks, setSuggestingAsks] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const [showAgents, setShowAgents] = useState(false);
  const [saveName, setSaveName] = useState('');
  const saveRef = useRef(null);

  useEffect(() => { localStorage.setItem(PROFILE_KEY, profile); }, [profile]);
  useEffect(() => { try { localStorage.setItem(ACTIVE_KEY, JSON.stringify(mission)); } catch {} }, [mission]);

  const setGoal = (g) => setMission((m) => ({ ...m, goal: g }));
  const setModel = (md) => setMission((m) => ({ ...m, model: md }));
  const setBudget = (v) => setMission((m) => ({ ...m, budget: v }));
  const addCost = (c) => {
    if (!c) return;
    setMission((m) => ({ ...m, cost: (m.cost || 0) + c }));
    setTotalCost((t) => { const nt = t + c; try { localStorage.setItem(TOTAL_KEY, String(nt)); } catch {} return nt; });
  };
  const patchAgent = (id, patch) => setMission((m) => ({ ...m, agents: m.agents.map((a) => (a.id === id ? { ...a, ...patch } : a)) }));
  const addAgent = () => setMission((m) => ({ ...m, agents: [...m.agents, { ...blankAgent(), officeSeed: Math.floor(Math.random() * 1e9) }] }));
  const addPreset = (pre) => { setMission((m) => ({ ...m, agents: [...m.agents, { ...blankAgent(), emoji: pre.emoji, name: pre.name, role: pre.role, model: pre.model, webSearch: pre.webSearch, task: pre.task, officeSeed: Math.floor(Math.random() * 1e9) }] })); setShowAgents(false); };
  const addBlankAgent = () => { addAgent(); setShowAgents(false); };
  const removeAgent = (id) => setMission((m) => ({ ...m, agents: m.agents.filter((a) => a.id !== id) }));
  const dupAgent = (id) => setMission((m) => {
    const i = m.agents.findIndex((a) => a.id === id); if (i < 0) return m;
    const copy = { ...m.agents[i], id: uid(), name: m.agents[i].name + ' copy', result: '', sources: [], cost: 0, busy: false };
    const arr = [...m.agents]; arr.splice(i + 1, 0, copy); return { ...m, agents: arr };
  });
  const moveAgent = (id, dir) => setMission((m) => {
    const i = m.agents.findIndex((a) => a.id === id); const j = i + dir;
    if (i < 0 || j < 0 || j >= m.agents.length) return m;
    const arr = [...m.agents]; [arr[i], arr[j]] = [arr[j], arr[i]]; return { ...m, agents: arr };
  });
  const insertHandle = (id, h) => setMission((m) => ({ ...m, agents: m.agents.map((a) => (a.id === id ? { ...a, task: (a.task ? a.task + ' ' : '') + `{{${h}}}` } : a)) }));

  async function enhanceGoal() {
    if (!mission.goal.trim()) return;
    setEnhancing(true); setError('');
    try {
      const r = await fetch(`${API}/api/admin/workflow/agent/enhance`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ goal: mission.goal, profile, model: mission.model }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error || 'Enhance failed.'); return; }
      setGoal(data.goal || mission.goal); addCost(data.costUSD); setStatus('Mission sharpened. Assemble the team when ready.');
    } catch {
      setError('Could not reach the server.');
    } finally {
      setEnhancing(false);
    }
  }

  async function generateGoals() {
    setGeneratingGoals(true); setError(''); setStatus('Generating goals from HAL…');
    try {
      const r = await fetch(`${API}/api/admin/workflow/agent/goals`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ profile, model: mission.model, steer: pitchSteer }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error || 'Could not generate goals.'); return; }
      setGoalIdeas(data.goals || []); addCost(data.costUSD); setStatus('Tap a goal to load it.');
    } catch {
      setError('Could not reach the server.');
    } finally {
      setGeneratingGoals(false);
    }
  }

  async function assemble() {
    setError(''); setBusy(true); setStatus('Commander is planning…');
    try {
      const r = await fetch(`${API}/api/admin/workflow/agent/plan`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ goal: mission.goal, profile, model: mission.model }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error || 'Planning failed.'); return; }
      setMission((m) => ({
        ...m, summary: data.summary || '', cost: (m.cost || 0) + (data.costUSD || 0),
        agents: (data.agents || []).map((a) => ({
          id: uid(), emoji: a.emoji || '🤖', name: a.name || 'Agent', role: a.role || '',
          model: MODELS.find((x) => x.id === a.model) ? a.model : 'claude-sonnet-4-6',
          webSearch: true, enabled: true, task: a.firstTask || '', result: '', sources: [], cost: 0, busy: false, officeSeed: 0,
        })),
      }));
      setStatus('Team assembled. Edit anything, wire tasks together, then run.');
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  }

  async function callRun(agent, ctx, signal) {
    const r = await fetch(`${API}/api/admin/workflow/agent/run`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ role: agent.role, task: agent.task, profile, model: agent.model, webSearch: agent.webSearch, context: ctx, goal: mission.goal }), signal,
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'run failed');
    return data;
  }

  function stopAgent(id) {
    abortedRef.current.add(id);
    const c = controllersRef.current[id];
    if (c) c.abort();
    patchAgent(id, { busy: false, result: 'Stopped.' });
    setStatus('Stopped.');
  }

  async function runOne(id) {
    const agent = mission.agents.find((a) => a.id === id);
    if (!agent) return;
    const ctx = {};
    mission.agents.forEach((a) => { if (a.id !== id && a.result) ctx[handleOf(a.name, a.id)] = a.result; });
    const controller = new AbortController();
    controllersRef.current[id] = controller;
    const t0 = Date.now();
    patchAgent(id, { busy: true, result: '', sources: [], startedAt: t0, ms: 0 });
    setStatus(`Running ${agent.name}…`);
    try {
      const data = await callRun(agent, ctx, controller.signal);
      if (abortedRef.current.has(id)) return;
      patchAgent(id, { busy: false, result: data.text || '', sources: data.sources || [], cost: (agent.cost || 0) + (data.costUSD || 0), ms: Date.now() - t0 });
      addCost(data.costUSD); setStatus(`${agent.name} done.`);
    } catch (e) {
      if (e.name === 'AbortError') { patchAgent(id, { busy: false, result: 'Stopped.', ms: Date.now() - t0 }); setStatus(`${agent.name} stopped.`); }
      else { patchAgent(id, { busy: false, result: 'Error: ' + e.message, ms: Date.now() - t0 }); setStatus(''); }
    } finally {
      delete controllersRef.current[id];
      abortedRef.current.delete(id);
    }
  }

  async function runAll() {
    setError(''); setRunningAll(true); stopRef.current = false;
    const ctx = {};
    for (const a of mission.agents) {
      if (!a.enabled) continue;
      if (stopRef.current) { setStatus('Mission stopped.'); break; }
      setStatus(`Running ${a.name}…`);
      const t0 = Date.now();
      patchAgent(a.id, { busy: true, result: '', sources: [], startedAt: t0, ms: 0 });
      const controller = new AbortController();
      controllersRef.current[a.id] = controller;
      try {
        const data = await callRun(a, ctx, controller.signal);
        if (abortedRef.current.has(a.id)) { break; }
        patchAgent(a.id, { busy: false, result: data.text || '', sources: data.sources || [], cost: (a.cost || 0) + (data.costUSD || 0), ms: Date.now() - t0 });
        addCost(data.costUSD);
        ctx[handleOf(a.name, a.id)] = data.text || '';
      } catch (e) {
        if (e.name === 'AbortError') { patchAgent(a.id, { busy: false, result: 'Stopped.', ms: Date.now() - t0 }); break; }
        patchAgent(a.id, { busy: false, result: 'Error: ' + e.message, ms: Date.now() - t0 });
      } finally {
        delete controllersRef.current[a.id];
        abortedRef.current.delete(a.id);
      }
    }
    setRunningAll(false); setStatus('Mission run complete.');
  }

  async function suggestAsks() {
    const results = mission.agents.filter((a) => a.result).map((a) => `### ${a.name}\n${a.result}`).join('\n\n');
    if (!results) { setStatus('Run some agents first so I can suggest questions.'); return; }
    setSuggestingAsks(true);
    try {
      const r = await fetch(`${API}/api/admin/workflow/agent/questions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ goal: mission.goal, results, profile, model: analyst.model }) });
      const data = await r.json();
      if (!r.ok) { setStatus(data.error || 'Could not suggest questions.'); return; }
      setAsks((data.questions || []).slice(0, 3)); addCost(data.costUSD);
    } catch { setStatus('Could not reach the server.'); }
    finally { setSuggestingAsks(false); }
  }

  async function askAnalyst(qOverride) {
    const question = qOverride || analyst.question;
    if (!question.trim()) return;
    const results = mission.agents.filter((a) => a.result).map((a) => `### ${a.name}\n${a.result}`).join('\n\n');
    if (!results) { setAnalyst((s) => ({ ...s, result: 'Run some agents first so I have something to work with.' })); return; }
    setAnalyst((s) => ({ ...s, busy: true, result: '', sources: [], question }));
    try {
      const r = await fetch(`${API}/api/admin/workflow/agent/ask`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question, results, goal: mission.goal, profile, model: analyst.model, webSearch: analyst.webSearch }),
      });
      const data = await r.json();
      if (!r.ok) { setAnalyst((s) => ({ ...s, busy: false, result: 'Error: ' + (data.error || 'ask failed') })); return; }
      setAnalyst((s) => ({ ...s, busy: false, result: data.text || '', sources: data.sources || [], cost: (s.cost || 0) + (data.costUSD || 0) }));
      addCost(data.costUSD);
    } catch {
      setAnalyst((s) => ({ ...s, busy: false, result: 'Could not reach the server.' }));
    }
  }

  async function compileOutbox() {
    setOutboxErr('');
    const results = mission.agents.filter((a) => a.result).map((a) => `### ${a.name}\n${a.result}`).join('\n\n');
    if (!results) { setOutboxErr('Run some agents first so the Dispatcher has something to work with.'); return; }
    setCompiling(true); setStatus('Dispatcher is compiling the outbox…');
    try {
      const r = await fetch(`${API}/api/admin/workflow/agent/dispatch`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ results, goal: mission.goal, profile, model: mission.model }),
      });
      const data = await r.json();
      if (!r.ok) { setOutboxErr(data.error || 'Compile failed.'); return; }
      const items = (data.items || []).map((it) => ({ id: uid(), sent: false, type: it.type || (it.channel === 'linkedin' ? 'linkedin' : 'email'), name: it.name || '', to: it.to || '', url: it.url || '', subject: it.subject || '', title: it.title || '', language: it.language || '', code: it.code || '', body: it.body || '' }));
      setMission((m) => ({ ...m, outbox: items }));
      addCost(data.costUSD); setStatus(`Outbox ready: ${items.length} item${items.length === 1 ? '' : 's'}.`);
    } catch {
      setOutboxErr('Could not reach the server.');
    } finally {
      setCompiling(false);
    }
  }
  const markSent = (id, sent) => setMission((m) => ({ ...m, outbox: (m.outbox || []).map((it) => (it.id === id ? { ...it, sent } : it)) }));
  const removeOutboxItem = (id) => setMission((m) => ({ ...m, outbox: (m.outbox || []).filter((it) => it.id !== id) }));
  const mailtoLink = (it) => `mailto:${encodeURIComponent(it.to)}?subject=${encodeURIComponent(it.subject || '')}&body=${encodeURIComponent(it.body || '')}`;
  const gmailLink = (it) => `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(it.to || '')}&su=${encodeURIComponent(it.subject || '')}&body=${encodeURIComponent(it.body || '')}`;

  async function draftCritique() {
    const results = mission.agents.filter((a) => a.result).map((a) => `### ${a.name}\n${a.result}`).join('\n\n');
    if (!results) { setStatus('Run some agents first, then I can critique them.'); return; }
    setDrafting(true); setStatus('Drafting an honest critique…');
    try {
      const r = await fetch(`${API}/api/admin/workflow/agent/ask`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question: 'Critique these results honestly and specifically. What was weak, generic, off target or low quality, and what should the team do differently next time? Give it as a short list of concrete improvements.', results, goal: mission.goal, profile, model: mission.model, webSearch: false }),
      });
      const data = await r.json();
      if (!r.ok) { setStatus(data.error || 'Could not draft critique.'); return; }
      setCritique((c) => (c ? c + '\n' : '') + (data.text || '')); addCost(data.costUSD); setStatus('Critique drafted. Edit it, then teach HAL.');
    } catch {
      setStatus('Could not reach the server.');
    } finally {
      setDrafting(false);
    }
  }

  async function teachSoul() {
    if (!critique.trim()) { setStatus('Write or draft a critique first.'); return; }
    const results = mission.agents.filter((a) => a.result).map((a) => `### ${a.name}\n${a.result}`).join('\n\n');
    setLearning(true); setStatus('Folding the lesson into HAL.md…');
    try {
      const r = await fetch(`${API}/api/admin/workflow/agent/learn`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ soul: profile, goal: mission.goal, results, critique, model: mission.model }),
      });
      const data = await r.json();
      if (!r.ok) { setStatus(data.error || 'Learn failed.'); return; }
      setSoulPreview(data.soul || ''); addCost(data.costUSD); setStatus('Proposed an improved HAL.md. Review it.');
    } catch {
      setStatus('Could not reach the server.');
    } finally {
      setLearning(false);
    }
  }

  function acceptSoul() { setProfile(soulPreview); setSoulPreview(null); setCritique(''); setStatus('HAL.md updated. Re-assemble the team to use it.'); }

  function newMission() { setMission(defaultMission()); setAnalyst((s) => ({ ...s, result: '', sources: [] })); setOutboxErr(''); setAsks([]); setStatus('New mission.'); setError(''); }
  function openSave() { setSaveName((mission.goal || 'Mission').slice(0, 40)); setShowSave(true); }
  function confirmSave() {
    const name = saveName.trim();
    if (!name) return;
    const snap = { ...mission, id: 'ms_' + Date.now(), name, agents: mission.agents.map((a) => ({ ...a, busy: false })) };
    const next = [...saved.filter((x) => x.name !== name), snap];
    setSaved(next); localStorage.setItem(SAVED_KEY, JSON.stringify(next)); setShowSave(false); setStatus(`Saved "${name}".`);
  }
  function loadMission(s) { setMission({ ...s, id: uid(), agents: (s.agents || []).map((a) => ({ ...a, busy: false })) }); setShowSaved(false); setStatus(`Loaded “${s.name}”.`); }
  function deleteMission(id) { const next = saved.filter((s) => s.id !== id); setSaved(next); localStorage.setItem(SAVED_KEY, JSON.stringify(next)); }

  const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  async function callRunRaw(agent, ctx, signal, sg, maxCostUSD) {
    const r = await fetch(`${API}/api/admin/workflow/agent/run`, { method: 'POST', headers: authHeaders, signal, body: JSON.stringify({ role: agent.role, task: agent.task, profile, model: agent.model, webSearch: agent.webSearch, context: ctx, goal: sg, maxCostUSD }) });
    const data = await r.json(); if (!r.ok) throw new Error(data.error || 'run failed'); return data;
  }
  async function askRaw(question, results, sg, model, maxCostUSD) {
    const r = await fetch(`${API}/api/admin/workflow/agent/ask`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ question, results, goal: sg, profile, model, webSearch: false, maxCostUSD }) });
    const data = await r.json(); if (!r.ok) throw new Error(data.error || 'ask failed'); return data;
  }
  async function dispatchRaw(results, sg, model, maxCostUSD) {
    const r = await fetch(`${API}/api/admin/workflow/agent/dispatch`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ results, goal: sg, profile, model, maxCostUSD }) });
    const data = await r.json(); if (!r.ok) throw new Error(data.error || 'dispatch failed'); return data;
  }
  async function learnRaw(soul, results, crit, sg, model, maxCostUSD) {
    const r = await fetch(`${API}/api/admin/workflow/agent/learn`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ soul, goal: sg, results, critique: crit, model, maxCostUSD }) });
    const data = await r.json(); if (!r.ok) throw new Error(data.error || 'learn failed'); return data;
  }

  function persistRun(id, record) {
    setSaved((prev) => {
      const next = prev.map((s) => {
        if (s.id !== id) return s;
        const prevRuns = s.runs || (s.lastRun ? [s.lastRun] : []);
        const runs = [record, ...prevRuns].slice(0, 50);
        const { lastRun, ...rest } = s;
        return { ...rest, runs };
      });
      localStorage.setItem(SAVED_KEY, JSON.stringify(next));
      return next;
    });
  }

  function pauseAuto() { autoPauseRef.current = true; setAutoRun((p) => (p ? { ...p, paused: true } : p)); setStatus('Paused.'); }
  function resumeAuto() { autoPauseRef.current = false; setAutoRun((p) => (p ? { ...p, paused: false } : p)); setStatus('Resumed.'); }
  function stopAuto() { autoStopRef.current = true; autoPauseRef.current = false; if (autoCtrlRef.current) autoCtrlRef.current.abort(); setStatus('Stopping…'); }

  async function runAuto(saved0) {
    if (autoRun && autoRun.running) return;
    autoStopRef.current = false; autoPauseRef.current = false;
    const sg = saved0.goal, sm = saved0.model;
    const budget = saved0.budget || 0;
    const runId = 'run_' + Date.now();
    const run = {
      id: saved0.id, runId, name: saved0.name, budget, running: true, paused: false, error: '', step: 'agents', log: [], cost: 0, ms: 0, halUpdated: false,
      agents: (saved0.agents || []).map((a) => ({ ...a, result: '', sources: [], cost: 0, ms: 0, busy: false, done: false })),
      analyst: { result: '', sources: [] }, outbox: [],
    };
    const t0all = Date.now();
    const sync = () => setAutoRun({ ...run, log: [...run.log], agents: run.agents.map((a) => ({ ...a })), analyst: { ...run.analyst }, outbox: [...run.outbox] });
    const push = (msg, kind) => { run.log.push({ msg, kind: kind || 'step', t: Date.now() }); sync(); };
    const gate = async () => { while (autoPauseRef.current && !autoStopRef.current) { run.paused = true; sync(); await sleep(150); } run.paused = false; return !autoStopRef.current; };

    // budget allocation: each step gets its fair weighted share of what is left; leftovers roll forward
    let remaining = budget;
    let remW = run.agents.filter((a) => a.enabled).length * 1.0 + 1.2 + 1.0 + (autoLearn ? 1.0 : 0);
    const alloc = (w) => { if (!budget) return undefined; if (remW <= 0) return remaining; return Math.max(0, Math.min(remaining, remaining * (w / remW))); };
    const spend = (w, actual) => { remaining = Math.max(0, remaining - (actual || 0)); remW = Math.max(0, remW - w); };
    const tooLow = (cap) => budget && (cap === undefined || cap < 0.01);

    setAutoRun(run); setStatus(`Running \u201c${saved0.name}\u201d\u2026`);

    try {
      const ctx = {};
      for (let i = 0; i < run.agents.length; i++) {
        const a = run.agents[i];
        if (!a.enabled) continue;
        if (!(await gate())) { push('Stopped.', 'stop'); break; }
        const cap = alloc(1.0);
        if (tooLow(cap)) { push(`\u23ed ${a.name} skipped \u2014 budget spent`, 'stop'); spend(1.0, 0); continue; }
        a.busy = true; run.step = 'agent'; push(`\u25b6 ${a.name}\u2026`, 'agent');
        const t0 = Date.now(); const controller = new AbortController(); autoCtrlRef.current = controller;
        try {
          const data = await callRunRaw(a, ctx, controller.signal, sg, cap);
          a.busy = false; a.ms = Date.now() - t0;
          if (data.skipped) { a.result = ''; push(`\u23ed ${a.name} skipped \u2014 budget`, 'stop'); spend(1.0, 0); }
          else {
            a.done = true; a.result = data.text || ''; a.sources = data.sources || []; a.cost = data.costUSD || 0;
            run.cost += data.costUSD || 0; addCost(data.costUSD);
            ctx[handleOf(a.name, a.id)] = a.result;
            push(`\u2713 ${a.name} \u00b7 ${fmtMs(a.ms)}`, 'done'); spend(1.0, data.costUSD || 0);
          }
        } catch (e) {
          a.busy = false; a.ms = Date.now() - t0;
          if (e.name === 'AbortError') { push(`\u25a0 ${a.name} stopped`, 'stop'); break; }
          a.result = 'Error: ' + e.message; push(`\u2715 ${a.name} error`, 'error'); spend(1.0, 0);
        } finally { autoCtrlRef.current = null; }
      }

      const results = resultsBlob(run.agents);

      if (!autoStopRef.current && results && (await gate())) {
        const cap = alloc(1.2);
        if (tooLow(cap)) { push('\u23ed Analyst skipped \u2014 budget spent', 'stop'); spend(1.2, 0); }
        else {
          run.step = 'analyst'; push('🧠 Analyst is synthesizing\u2026', 'analyst');
          try {
            const d = await askRaw(saved0.analystPrompt || DAILY_ANALYST_Q, results, sg, sm, cap);
            if (d.skipped) { push('\u23ed Analyst skipped \u2014 budget', 'stop'); spend(1.2, 0); }
            else { run.analyst = { result: d.text || '', sources: d.sources || [] }; run.cost += d.costUSD || 0; addCost(d.costUSD); push('\u2713 Plan ready', 'done'); spend(1.2, d.costUSD || 0); }
          } catch (e) { push('\u2715 Analyst error', 'error'); spend(1.2, 0); }
        }
      }

      if (!autoStopRef.current && results && (await gate())) {
        const cap = alloc(1.0);
        if (tooLow(cap)) { push('\u23ed Deliverables skipped \u2014 budget spent', 'stop'); spend(1.0, 0); }
        else {
          run.step = 'deliverables'; push('📦 Compiling deliverables\u2026', 'deliver');
          try {
            const d = await dispatchRaw(results, sg, sm, cap);
            if (d.skipped) { push('\u23ed Deliverables skipped \u2014 budget', 'stop'); spend(1.0, 0); }
            else { run.outbox = (d.items || []).map((it) => ({ id: uid(), sent: false, type: it.type || (it.channel === 'linkedin' ? 'linkedin' : 'email'), name: it.name || '', to: it.to || '', url: it.url || '', subject: it.subject || '', title: it.title || '', language: it.language || '', code: it.code || '', body: it.body || '' })); run.cost += d.costUSD || 0; addCost(d.costUSD); push(`\u2713 ${run.outbox.length} deliverable${run.outbox.length === 1 ? '' : 's'}`, 'done'); spend(1.0, d.costUSD || 0); }
          } catch (e) { push('\u2715 Compile error', 'error'); spend(1.0, 0); }
        }
      }

      if (!autoStopRef.current && results && autoLearn && (await gate())) {
        run.step = 'learn'; push('🧬 Critiquing and updating HAL\u2026', 'learn');
        let critText = '';
        const capC = alloc(0.5);
        if (tooLow(capC)) { push('\u23ed Critique skipped \u2014 budget spent', 'stop'); spend(0.5, 0); }
        else { try {
            const crit = await askRaw(CRITIQUE_Q, results, sg, sm, capC);
            if (crit.skipped) { push('\u23ed Critique skipped \u2014 budget', 'stop'); spend(0.5, 0); }
            else { critText = crit.text || ''; run.cost += crit.costUSD || 0; addCost(crit.costUSD); spend(0.5, crit.costUSD || 0); }
          } catch (e) { push('\u2715 Critique error', 'error'); spend(0.5, 0); } }
        const capL = alloc(0.5);
        if (!critText) { spend(0.5, 0); }
        else if (tooLow(capL)) { push('\u23ed HAL update skipped \u2014 budget spent', 'stop'); spend(0.5, 0); }
        else { try {
            const learned = await learnRaw(profile, results, critText, sg, sm, capL);
            if (learned.skipped) { push('\u23ed HAL update skipped \u2014 budget', 'stop'); spend(0.5, 0); }
            else if (learned.soul) { setProfile(learned.soul); run.halUpdated = true; run.cost += learned.costUSD || 0; addCost(learned.costUSD); push('\u2713 HAL.md updated', 'done'); spend(0.5, learned.costUSD || 0); }
            else { spend(0.5, learned.costUSD || 0); }
          } catch (e) { push('\u2715 Learn error', 'error'); spend(0.5, 0); } }
      }

      run.running = false; run.step = 'done'; run.ms = Date.now() - t0all;
      const capLine = budget ? ` / ${money(budget)}` : '';
      push(autoStopRef.current ? 'Run stopped.' : `Done \u00b7 ${fmtMs(run.ms)} \u00b7 ${money(run.cost)}${capLine}`, autoStopRef.current ? 'stop' : 'finish');
      persistRun(saved0.id, { id: runId, at: Date.now(), budget, log: run.log, agents: run.agents, analyst: run.analyst, outbox: run.outbox, cost: run.cost, ms: run.ms, halUpdated: run.halUpdated });
      setStatus(autoStopRef.current ? 'Run stopped.' : `\u201c${saved0.name}\u201d complete.`);
    } catch (e) {
      run.running = false; run.error = e.message; push('Error: ' + e.message, 'error');
      setStatus('Run error.');
    }
  }


  const anyBusy = busy || enhancing || generatingGoals || runningAll || analyst.busy || compiling || learning || drafting || mission.agents.some((a) => a.busy);
  const [, setTick] = useState(0);
  useEffect(() => {
    const live = mission.agents.some((a) => a.busy) || analyst.busy;
    if (!live) return;
    const iv = setInterval(() => setTick((t) => t + 1), 100);
    return () => clearInterval(iv);
  }, [mission.agents, analyst.busy]);
  const haveResults = mission.agents.some((a) => a.result);
  useEffect(() => {
    if (openAnalyst && haveResults && asks.length === 0 && !suggestingAsks) suggestAsks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openAnalyst, haveResults]);
  useEffect(() => { if (showSave && saveRef.current) { saveRef.current.focus(); saveRef.current.select(); } }, [showSave]);

  return (
    <section className="admin__card">
      <div className="admin__toolhead">
        <div>
          <h2 className="admin__title">Command Center</h2>
          <p className="admin__muted">Sharpen a goal, assemble a team, wire them together, run the mission, then ask the Analyst to pull it into a plan.</p>
        </div>
        <div className="mc__costwrap">
          <div className="mc__costrow">
            <span className="mc__costlabel">this mission</span>
            <span className="mc__cost">{money(mission.cost)}</span>
            {mission.cost > 0 && <button className="mc__reset" onClick={() => setMission((m) => ({ ...m, cost: 0 }))}>reset</button>}
          </div>
          <div className="mc__costrow mc__costrow--total">
            <span className="mc__costlabel">all missions</span>
            <span className="mc__cost mc__cost--total">{money(totalCost)}</span>
            {totalCost > 0 && <button className="mc__reset" onClick={() => { if (window.confirm('Reset the all-time total to zero?')) { setTotalCost(0); try { localStorage.setItem(TOTAL_KEY, '0'); } catch {} } }}>reset</button>}
          </div>
        </div>
      </div>

      <div className="mc__topbar">
        <button className="flow__ghost" onClick={newMission}>New mission</button>
        <button className="flow__ghost" onClick={openSave}>Save</button>
        <button className="flow__ghost" onClick={() => setShowSaved((s) => !s)}>Missions{saved.length ? ` (${saved.length})` : ''}</button>
        <button className="flow__ghost" onClick={() => setShowProfile(true)}>Edit HAL</button>
        <span className="mc__status">{status}</span>
      </div>

      {showSaved && (
        <div className="flow__helppanel mc__missions">
          <div className="mc__mshead">
            <p className="admin__label" style={{ margin: 0 }}>Saved missions — run the whole pipeline in one click</p>
            <label className="mc__toggle" title="critique each run and fold the lesson into HAL.md automatically"><input type="checkbox" checked={autoLearn} onChange={(e) => setAutoLearn(e.target.checked)} /> auto-learn</label>
          </div>
          {saved.length === 0 && <p className="admin__muted" style={{ margin: '0.4rem 0 0' }}>No saved missions yet. Build a team above, then Save.</p>}
          {saved.map((s) => {
            const live = autoRun && autoRun.id === s.id;
            const running = live && autoRun.running;
            const runs = s.runs || (s.lastRun ? [s.lastRun] : []);
            const avg = runs.length ? runs.reduce((t, r) => t + (r.cost || 0), 0) / runs.length : 0;
            const expanded = expandedSaved === s.id;
            return (
              <div className={`mc__msrow ${running ? 'mc__msrow--live' : ''}`} key={s.id}>
                <div className="mc__mstop">
                  <button className="mc__msname" onClick={() => setExpandedSaved(expanded ? null : s.id)} title="show the agents">
                    <span className="mc__chev">{expanded ? '▾' : '▸'}</span>{s.name}
                  </button>
                  <span className="mc__msmeta">{(s.agents || []).length} agents{runs.length ? ` · ${runs.length} run${runs.length === 1 ? '' : 's'} · avg ${money(avg)}` : ''}{s.budget ? ` · ${money(s.budget)} cap` : ''}</span>
                  <span className="mc__msbtns">
                    {running ? (
                      <>
                        {autoRun.paused
                          ? <button className="admin__btn mc__run mc__msbtn" onClick={resumeAuto}>▶ Resume</button>
                          : <button className="flow__ghost mc__msbtn" onClick={pauseAuto}>⏸ Pause</button>}
                        <button className="flow__ghost mc__msbtn mc__stopbtn" onClick={stopAuto}>■ Stop</button>
                      </>
                    ) : (
                      <button className="admin__btn mc__run mc__msbtn" onClick={() => runAuto(s)} disabled={autoRun && autoRun.running}>▶ Run</button>
                    )}
                    <button className="flow__ghost mc__msbtn" onClick={() => { setResultsView(s.id); setOpenRun(null); }} disabled={runs.length === 0 && !running}>▦ History</button>
                    <button className="fnode__copy" onClick={() => deleteMission(s.id)} title="delete">✕</button>
                  </span>
                </div>

                {running && (
                  <div className="mc__mslog">
                    {s.budget > 0 && (
                      <div className="mc__budgetwrap">
                        <div className="mc__budgetbar"><div className="mc__budgetfill" style={{ width: `${Math.min(100, (autoRun.cost / s.budget) * 100)}%` }} /></div>
                        <span className="mc__budgetnum">{money(autoRun.cost)} / {money(s.budget)}</span>
                      </div>
                    )}
                    {autoRun.log.slice(-4).map((l, i) => <div key={i} className={`mc__mslogline mc__mslogline--${l.kind}`}>{l.msg}</div>)}
                    {autoRun.paused && <div className="mc__mslogline mc__mslogline--stop">Paused — Resume to continue.</div>}
                  </div>
                )}

                {expanded && (
                  <div className="mc__msagents">
                    {(s.agents || []).map((a) => (
                      <div className={`mc__msagent ${a.enabled ? '' : 'mc__msagent--off'}`} key={a.id}>
                        <span className="mc__msemoji">{a.emoji}</span>
                        <span className="mc__msaname">{a.name}</span>
                        <span className="mc__msamodel">{((MODELS.find((m) => m.id === a.model) || {}).label) || a.model}{a.webSearch ? ' · web' : ''}{a.enabled ? '' : ' · off'}</span>
                      </div>
                    ))}
                    <button className="flow__ghost" style={{ marginTop: '0.5rem' }} onClick={() => loadMission(s)}>Open &amp; edit in builder</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mc__pitchrow">
        <input className="mc__steer" placeholder="steer the pitch, e.g. not just law clients, Irish SMEs" value={pitchSteer} onChange={(e) => setPitchSteer(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !anyBusy) generateGoals(); }} />
        <button className="flow__ghost mc__gengoals" onClick={generateGoals} disabled={anyBusy}>
          {generatingGoals ? 'Thinking…' : (goalIdeas.length ? '↻ Re-pitch' : '💡 Pitch ideas')}
        </button>
      </div>
      {goalIdeas.length > 0 && (
        <div className="mc__goalideas">
          <div className="mc__goalideashead">
            <span className="admin__label" style={{ margin: 0 }}>Tap a goal to load it{pitchSteer.trim() ? ' · steered' : ''}</span>
            <button className="fnode__copy" onClick={() => setGoalIdeas([])}>dismiss</button>
          </div>
          {goalIdeas.map((g, i) => (
            <button key={i} className="mc__goalidea" onClick={() => { setGoal(g); setGoalIdeas([]); setStatus('Goal loaded.'); }}>{g}</button>
          ))}
        </div>
      )}

      <label className="admin__label">Your goal</label>
      <textarea className="admin__textarea admin__textarea--sm" rows={2} placeholder="what do you want? or tap a pitch above" value={mission.goal} onChange={(e) => setGoal(e.target.value)} />

      <div className="mc__goalrow">
        <button className="flow__ghost mc__enhance" onClick={enhanceGoal} disabled={anyBusy || !mission.goal.trim()}>{enhancing ? 'Sharpening…' : '✨ Enhance'}</button>
        <select className="fnode__model mc__model" value={mission.model} onChange={(e) => setModel(e.target.value)} title="model the Commander uses to plan">
          {MODELS.map((m) => <option key={m.id} value={m.id}>Commander: {m.label}</option>)}
        </select>
        <label className="mc__budget" title="cap one full auto-run in dollars; 0 = no cap"><span className="mc__budgetsign">$</span><input type="number" min="0" step="0.5" value={mission.budget || ''} onChange={(e) => setBudget(parseFloat(e.target.value) || 0)} placeholder="budget" /></label>
        <button className="admin__btn mc__assemble" onClick={assemble} disabled={anyBusy || !mission.goal.trim()}>
          {busy ? 'Assembling…' : mission.agents.length ? 'Re-assemble' : 'Assemble team'}
        </button>
        {mission.agents.length > 0 && (
          <button className="admin__btn mc__runall" onClick={runAll} disabled={anyBusy}>
            {runningAll ? 'Running…' : '▶ Run all'}
          </button>
        )}
        {runningAll && (
          <button className="flow__ghost mc__stop" onClick={() => { stopRef.current = true; Object.keys(controllersRef.current).forEach((aid) => { abortedRef.current.add(aid); controllersRef.current[aid].abort(); }); setStatus('Stopping…'); }}>■ Stop</button>
        )}
        <button className="flow__ghost" onClick={() => setShowAgents(true)}>+ Agent</button>
      </div>

      {error && <p className="admin__error">{error}</p>}

      {mission.summary && (
        <div className="mc__summary">
          <span className="mc__commander">⬢ Commander</span>
          <p>{mission.summary}</p>
        </div>
      )}

      {mission.agents.length > 0 && (
        <div className="mc__team">
          {mission.agents.map((a, i) => {
            const others = mission.agents.filter((x) => x.id !== a.id).map((x) => handleOf(x.name, x.id));
            return (
              <div className={`mc__agent ${a.enabled ? '' : 'mc__agent--off'} ${a.busy ? 'mc__agent--busy' : ''}`} key={a.id}>
                <div className="mc__office">
                  <AgentOffice key={a.id + ':' + (a.officeSeed || 0)} agent={a} seed={a.officeSeed || 0} />
                  <button className="mc__reroll" title="new office" onClick={() => patchAgent(a.id, { officeSeed: (a.officeSeed || 0) + 1 })}>⟳</button>
                </div>
                <div className="mc__agenthead">
                  <input className="mc__emojiin" value={a.emoji} maxLength={2} onChange={(e) => patchAgent(a.id, { emoji: e.target.value })} />
                  <input className="mc__namein" value={a.name} onChange={(e) => patchAgent(a.id, { name: e.target.value })} />
                  {a.cost > 0 && <span className="mc__agentcost">{money(a.cost)}</span>}
                  {a.busy && a.startedAt
                    ? <span className="mc__agenttime mc__agenttime--live">{fmtMs(Date.now() - a.startedAt)}</span>
                    : a.ms > 0 ? <span className="mc__agenttime" title="last run time">{fmtMs(a.ms)}</span> : null}
                  <span className="mc__cardicons">
                    <button className="fnode__copy" onClick={() => moveAgent(a.id, -1)} disabled={i === 0}>↑</button>
                    <button className="fnode__copy" onClick={() => moveAgent(a.id, 1)} disabled={i === mission.agents.length - 1}>↓</button>
                    <button className="fnode__copy" onClick={() => dupAgent(a.id)}>⧉</button>
                    <button className="fnode__copy" onClick={() => removeAgent(a.id)}>✕</button>
                  </span>
                </div>

                <div className="mc__controls">
                  <label className="mc__toggle" title="include in Run all"><input type="checkbox" checked={a.enabled} onChange={(e) => patchAgent(a.id, { enabled: e.target.checked })} /> on</label>
                  <select className="fnode__model" value={a.model} onChange={(e) => patchAgent(a.id, { model: e.target.value })}>
                    {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select>
                  <label className="mc__toggle"><input type="checkbox" checked={a.webSearch} onChange={(e) => patchAgent(a.id, { webSearch: e.target.checked })} /> web</label>
                </div>

                <details className="mc__roledetails">
                  <summary>Role &amp; specialty</summary>
                  <textarea className="admin__textarea admin__textarea--sm" rows={4} value={a.role} onChange={(e) => patchAgent(a.id, { role: e.target.value })} />
                </details>

                <div className="mc__handle">
                  this is <b>{`{{${handleOf(a.name, a.id)}}}`}</b>
                  {others.length > 0 && <> · tap to use a teammate: {others.map((h) => <button key={h} className="mc__chip" onClick={() => insertHandle(a.id, h)}>{`{{${h}}}`}</button>)}</>}
                </div>

                <textarea className="admin__textarea admin__textarea--sm" rows={3} value={a.task} placeholder="what should this agent do? pull a teammate's output with {{Name}}" onChange={(e) => patchAgent(a.id, { task: e.target.value })} />
                <button className={`admin__btn mc__run ${a.busy ? 'mc__stopbtn' : ''}`} onClick={() => (a.busy ? stopAgent(a.id) : runOne(a.id))} disabled={!a.task.trim() || (anyBusy && !a.busy)}>{a.busy ? '■ Stop' : 'Run agent'}</button>

                {a.result && (
                  <div className="mc__resultwrap">
                    <div className="mc__resulthead">
                      <span className="admin__label" style={{ margin: 0 }}>Output</span>
                      <span className="mc__resultbtns">
                        <button className="fnode__copy" onClick={() => navigator.clipboard.writeText(a.result)}>copy</button>
                        <button className="fnode__copy" onClick={() => setViewing({ name: a.name, text: a.result })}>expand</button>
                      </span>
                    </div>
                    <div className="admin__output mc__result mc__result--clamp">{a.result}</div>
                  </div>
                )}
                {a.sources && a.sources.length > 0 && (
                  <div className="mc__sources">
                    <span className="admin__label" style={{ marginTop: '0.6rem' }}>Sources</span>
                    {a.sources.slice(0, 6).map((s, si) => (<a key={si} className="mc__source" href={s.url} target="_blank" rel="noopener noreferrer">{s.title || s.url}</a>))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {mission.agents.length > 0 && (
        <div className="mc__analyst">
          <div className="mc__panelhead">
            <button className="mc__paneltoggle" onClick={() => setOpenAnalyst((o) => !o)}>
              <span className="mc__emoji">🧠</span>
              <span className="mc__paneltitle">Mission Analyst</span>
              {analyst.cost > 0 && <span className="mc__agentcost">{money(analyst.cost)}</span>}
              <span className="mc__chev">{openAnalyst ? '▾' : '▸'}</span>
            </button>
          </div>
          {openAnalyst && (
            <div className="mc__panelbody">
              <div className="mc__askshead">
                <span className="admin__muted">{asks.length ? 'Questions from your results' : 'Quick questions'}</span>
                <button className="fnode__copy" onClick={suggestAsks} disabled={anyBusy || !haveResults}>{suggestingAsks ? 'Thinking…' : (asks.length ? '↻ Re-suggest' : '✨ Suggest from results')}</button>
              </div>
              <div className="mc__quickasks">
                {(asks.length ? asks : QUICK_ASKS).map((q) => <button key={q} className="flow__libcard" onClick={() => askAnalyst(q)} disabled={anyBusy || !haveResults}>{q}</button>)}
              </div>
              <textarea className="admin__textarea admin__textarea--sm" rows={2} placeholder="ask anything about the team's work…" value={analyst.question} onChange={(e) => setAnalyst((s) => ({ ...s, question: e.target.value }))} />
              <div className="mc__controls" style={{ marginTop: '0.5rem' }}>
                <select className="fnode__model" value={analyst.model} onChange={(e) => setAnalyst((s) => ({ ...s, model: e.target.value }))}>
                  {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
                <label className="mc__toggle"><input type="checkbox" checked={analyst.webSearch} onChange={(e) => setAnalyst((s) => ({ ...s, webSearch: e.target.checked }))} /> web</label>
                <button className="admin__btn mc__run" style={{ marginTop: 0 }} onClick={() => askAnalyst()} disabled={anyBusy || !analyst.question.trim() || !haveResults}>{analyst.busy ? 'Thinking…' : 'Ask Analyst'}</button>
              </div>
              {analyst.result && (
                <div className="mc__resultwrap" style={{ marginTop: '0.8rem' }}>
                  <div className="mc__resulthead">
                    <span className="admin__label" style={{ margin: 0 }}>Analyst</span>
                    <span className="mc__resultbtns">
                      <button className="fnode__copy" onClick={() => navigator.clipboard.writeText(analyst.result)}>copy</button>
                      <button className="fnode__copy" onClick={() => setViewing({ name: 'Mission Analyst', text: analyst.result })}>expand</button>
                    </span>
                  </div>
                  <div className="admin__output mc__result mc__result--clamp">{analyst.result}</div>
                  {analyst.sources && analyst.sources.length > 0 && (
                    <div className="mc__sources">
                      <span className="admin__label" style={{ marginTop: '0.6rem' }}>Sources</span>
                      {analyst.sources.slice(0, 6).map((s, si) => (<a key={si} className="mc__source" href={s.url} target="_blank" rel="noopener noreferrer">{s.title || s.url}</a>))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {mission.agents.length > 0 && (
        <div className="mc__outbox">
          <div className="mc__panelhead">
            <button className="mc__paneltoggle" onClick={() => setOpenDeliver((o) => !o)}>
              <span className="mc__emoji">📦</span>
              <span className="mc__paneltitle">Deliverables{mission.outbox && mission.outbox.length ? ` (${mission.outbox.length})` : ''}</span>
              <span className="mc__chev">{openDeliver ? '▾' : '▸'}</span>
            </button>
            <button className="admin__btn mc__run" style={{ marginTop: 0, marginLeft: 'auto', width: 'auto', paddingLeft: '1.1rem', paddingRight: '1.1rem' }} onClick={compileOutbox} disabled={anyBusy || !haveResults}>
              {compiling ? 'Compiling…' : (mission.outbox && mission.outbox.length ? 'Re-compile' : 'Compile')}
            </button>
          </div>
          {outboxErr && <p className="admin__error">{outboxErr}</p>}
          {openDeliver && (
            <div className="mc__panelbody">
              {mission.outbox && mission.outbox.length > 0 ? (
                <div className="mc__outlist">
                  {mission.outbox.map((it) => {
                    const type = it.type || 'email';
                    const actionable = type === 'email' || type === 'linkedin' || type === 'task';
                    const label = { email: '✉ email', linkedin: 'in linkedin', advice: '◆ advice', code: '⟨⟩ code', task: '✓ task' }[type] || type;
                    return (
                      <div className={`mc__outitem ${it.sent ? 'mc__outitem--sent' : ''}`} key={it.id}>
                        <div className="mc__outtop">
                          <span className={`mc__chanbadge mc__chanbadge--${type}`}>{label}</span>
                          <span className="mc__outname">{it.name || it.title}</span>
                          {actionable && <label className="mc__toggle" style={{ marginLeft: 'auto' }}><input type="checkbox" checked={it.sent} onChange={(e) => markSent(it.id, e.target.checked)} /> {type === 'task' ? 'done' : 'sent'}</label>}
                          <button className="fnode__copy" style={actionable ? {} : { marginLeft: 'auto' }} onClick={() => removeOutboxItem(it.id)}>✕</button>
                        </div>
                        {type === 'email' && it.to && <div className="mc__outmeta">to: {it.to}</div>}
                        {type === 'email' && it.subject && <div className="mc__outmeta">subject: {it.subject}</div>}
                        {type === 'linkedin' && it.url && <div className="mc__outmeta">profile: {it.url}</div>}
                        {type === 'code' && it.body && <div className="mc__outmeta">{it.body}</div>}
                        {type === 'code'
                          ? <pre className="mc__code"><code>{it.code}</code></pre>
                          : <div className="mc__outbody">{it.body}</div>}
                        <div className="mc__outactions">
                          {type === 'email' && it.to && <a className="admin__btn mc__send" href={mailtoLink(it)}>Open in email</a>}
                          {type === 'email' && it.to && <a className="flow__ghost" href={gmailLink(it)} target="_blank" rel="noopener noreferrer">Gmail</a>}
                          {type === 'email' && !it.to && <span className="mc__nomail">no email found · find via Hunter.io</span>}
                          {type === 'linkedin' && it.url && <a className="admin__btn mc__send" href={it.url} target="_blank" rel="noopener noreferrer">Open profile</a>}
                          <button className="flow__ghost" onClick={() => navigator.clipboard.writeText(type === 'code' ? it.code : (it.subject ? it.subject + '\n\n' + it.body : it.body))}>Copy</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : <p className="admin__muted">Compile turns the team's work into emails, LinkedIn messages, code and tasks you can act on.</p>}
            </div>
          )}
        </div>
      )}

      {mission.agents.length > 0 && (
        <div className="mc__learn">
          <div className="mc__panelhead">
            <button className="mc__paneltoggle" onClick={() => setOpenLearn((o) => !o)}>
              <span className="mc__emoji">🧬</span>
              <span className="mc__paneltitle">Critique &amp; learn</span>
              <span className="mc__chev">{openLearn ? '▾' : '▸'}</span>
            </button>
          </div>
          {openLearn && (
            <div className="mc__panelbody">
              <div className="mc__quickasks">
                <button className="flow__libcard" onClick={draftCritique} disabled={anyBusy || !haveResults}>{drafting ? 'Drafting…' : 'Draft critique from results'}</button>
              </div>
              <textarea className="admin__textarea admin__textarea--sm" rows={4} placeholder="what should be better next time? e.g. emails were too long, target smaller firms…" value={critique} onChange={(e) => setCritique(e.target.value)} />
              <button className="admin__btn mc__run" onClick={teachSoul} disabled={anyBusy || !critique.trim()}>{learning ? 'Teaching HAL…' : 'Teach HAL'}</button>
            </div>
          )}
        </div>
      )}

      {showAgents && (
        <div className="modal__backdrop" onClick={() => setShowAgents(false)}>
          <div className="modal__card modal__card--wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <h3 className="admin__title">Add an agent</h3>
              <button className="modal__close" onClick={() => setShowAgents(false)}>×</button>
            </div>
            <p className="admin__muted" style={{ marginTop: 0 }}>Pick a ready made specialist or start from a blank one. You can edit everything after adding.</p>
            <div className="mc__agentpicker">
              {AGENT_LIBRARY.map((pre) => (
                <button key={pre.name} className="mc__pick" onClick={() => addPreset(pre)}>
                  <span className="mc__pickemoji">{pre.emoji}</span>
                  <span className="mc__pickname">{pre.name}</span>
                  <span className="mc__pickrole">{pre.role}</span>
                  <span className="mc__pickmeta">
                    <span className="mc__pickbadge">{(MODELS.find((m) => m.id === pre.model) || {}).label || 'Sonnet'}</span>
                    {pre.webSearch && <span className="mc__pickbadge mc__pickbadge--web">web</span>}
                  </span>
                </button>
              ))}
              <button className="mc__pick mc__pick--blank" onClick={addBlankAgent}>
                <span className="mc__pickemoji">➕</span>
                <span className="mc__pickname">Blank agent</span>
                <span className="mc__pickrole">Start empty and define the role and task yourself.</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {showSave && (
        <div className="modal__backdrop" onClick={() => setShowSave(false)}>
          <div className="modal__card" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <h3 className="admin__title">Save mission</h3>
              <button className="modal__close" onClick={() => setShowSave(false)}>×</button>
            </div>
            <p className="admin__muted" style={{ marginTop: 0 }}>Name it so you can run the whole thing again from Missions. Reusing a name overwrites that mission.</p>
            <input ref={saveRef} className="mc__saveinput" value={saveName} onChange={(e) => setSaveName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') confirmSave(); if (e.key === 'Escape') setShowSave(false); }} placeholder="Mission name" />
            <div className="mc__outactions" style={{ marginTop: '0.9rem' }}>
              <button className="admin__btn mc__send" onClick={confirmSave} disabled={!saveName.trim()}>Save mission</button>
              <button className="flow__ghost" onClick={() => setShowSave(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {soulPreview !== null && (
        <div className="modal__backdrop" onClick={() => setSoulPreview(null)}>
          <div className="modal__card" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <h3 className="admin__title">Proposed HAL.md</h3>
              <button className="modal__close" onClick={() => setSoulPreview(null)}>×</button>
            </div>
            <p className="admin__muted">Review the improved HAL.md. Edit if you want, then accept. Re-assemble afterwards so the team reads it.</p>
            <textarea className="admin__textarea" rows={16} value={soulPreview} onChange={(e) => setSoulPreview(e.target.value)} />
            <div className="mc__outactions" style={{ marginTop: '0.6rem' }}>
              <button className="admin__btn mc__send" onClick={acceptSoul}>Accept &amp; save</button>
              <button className="flow__ghost" onClick={() => setSoulPreview(null)}>Discard</button>
            </div>
          </div>
        </div>
      )}

      {resultsView && (() => {
        const m = saved.find((s) => s.id === resultsView);
        if (!m) return null;
        const stored = m.runs || (m.lastRun ? [m.lastRun] : []);
        const live = (autoRun && autoRun.id === resultsView && autoRun.running) ? autoRun : null;
        const keyOf = (r) => r.id || String(r.at);
        const sel = openRun === 'live' ? (live ? { ...live, _live: true } : null) : (openRun ? stored.find((r) => keyOf(r) === openRun) : null);
        const ob = sel ? (sel.outbox || []) : [];
        const ag = sel ? (sel.agents || []).filter((a) => a.result) : [];
        return (
          <div className="modal__backdrop" onClick={() => { setResultsView(null); setOpenRun(null); }}>
            <div className="modal__card modal__card--wide" onClick={(e) => e.stopPropagation()}>
              <div className="modal__head">
                <h3 className="admin__title">{sel ? `${m.name} · run` : `${m.name} · history`}</h3>
                <span style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  {sel && <button className="fnode__copy" onClick={() => setOpenRun(null)}>← all runs</button>}
                  <button className="modal__close" onClick={() => { setResultsView(null); setOpenRun(null); }}>×</button>
                </span>
              </div>

              {!sel && ((live || stored.length > 0) ? (
                <>
                  <div className="mc__runlist">
                    {live && (
                      <button className="mc__runrow mc__runrow--live" onClick={() => setOpenRun('live')}>
                        <span className="mc__rundate">● Running now…</span>
                        <span className="mc__runmeta">{typeof live.cost === 'number' ? <span className="mc__agentcost">{money(live.cost)}</span> : null}</span>
                        <span className="mc__chev">▸</span>
                      </button>
                    )}
                    {stored.map((r) => (
                      <button key={keyOf(r)} className="mc__runrow" onClick={() => setOpenRun(keyOf(r))}>
                        <span className="mc__rundate">{fmtWhen(r.at)}</span>
                        <span className="mc__runmeta">
                          {typeof r.cost === 'number' ? <span className="mc__agentcost">{money(r.cost)}</span> : null}
                          {r.ms ? <span className="mc__agenttime">{fmtMs(r.ms)}</span> : null}
                          {r.halUpdated && <span className="mc__halbadge">HAL</span>}
                        </span>
                        <span className="mc__chev">▸</span>
                      </button>
                    ))}
                  </div>
                  {stored.length > 0 && <p className="admin__muted" style={{ marginTop: '0.7rem' }}>{stored.length} run{stored.length === 1 ? '' : 's'} saved · avg {money(stored.reduce((t, r) => t + (r.cost || 0), 0) / stored.length)} per run</p>}
                </>
              ) : <p className="admin__muted" style={{ marginTop: 0 }}>No runs yet. Hit Run to do one.</p>)}

              {sel && (
                <>
                  {sel._live && sel.running && (
                    <div className="mc__mslog" style={{ marginBottom: '0.8rem' }}>
                      {(sel.log || []).slice(-6).map((l, i) => <div key={i} className={`mc__mslogline mc__mslogline--${l.kind}`}>{l.msg}</div>)}
                    </div>
                  )}
                  <div className="mc__msresmeta">
                    {!sel._live && <span className="admin__muted">{fmtWhen(sel.at)}</span>}
                    {sel.ms ? <span className="mc__agenttime">{fmtMs(sel.ms)}</span> : null}
                    {typeof sel.cost === 'number' ? <span className="mc__agentcost">{money(sel.cost)}</span> : null}
                    {sel.halUpdated && <span className="mc__halbadge">HAL updated</span>}
                    {sel.budget ? <span className="admin__muted">cap {money(sel.budget)}</span> : null}
                  </div>

                  {sel.analyst && sel.analyst.result ? (
                    <>
                      <div className="mc__resulthead">
                        <span className="admin__label" style={{ margin: 0 }}>Plan for today</span>
                        <button className="fnode__copy" onClick={() => navigator.clipboard.writeText(sel.analyst.result)}>copy</button>
                      </div>
                      <div className="admin__output" style={{ whiteSpace: 'pre-wrap', maxHeight: '300px', overflow: 'auto' }}>{sel.analyst.result}</div>
                    </>
                  ) : <p className="admin__muted" style={{ marginTop: 0 }}>No synthesis in this run.</p>}

                  {ob.length > 0 && (
                    <>
                      <span className="admin__label" style={{ marginTop: '0.9rem' }}>Deliverables ({ob.length})</span>
                      <div className="mc__outlist">
                        {ob.map((it) => {
                          const type = it.type || 'email';
                          const label = { email: '✉ email', linkedin: 'in linkedin', advice: '◆ advice', code: '⟨⟩ code', task: '✓ task' }[type] || type;
                          return (
                            <div className="mc__outitem" key={it.id}>
                              <div className="mc__outtop">
                                <span className={`mc__chanbadge mc__chanbadge--${type}`}>{label}</span>
                                <span className="mc__outname">{it.name || it.title}</span>
                              </div>
                              {type === 'email' && it.to && <div className="mc__outmeta">to: {it.to}</div>}
                              {type === 'email' && it.subject && <div className="mc__outmeta">subject: {it.subject}</div>}
                              {type === 'code' ? <pre className="mc__code"><code>{it.code}</code></pre> : <div className="mc__outbody">{it.body}</div>}
                              <div className="mc__outactions">
                                {type === 'email' && it.to && <a className="admin__btn mc__send" href={mailtoLink(it)}>Open in email</a>}
                                {type === 'email' && it.to && <a className="flow__ghost" href={gmailLink(it)} target="_blank" rel="noopener noreferrer">Gmail</a>}
                                {type === 'linkedin' && it.url && <a className="admin__btn mc__send" href={it.url} target="_blank" rel="noopener noreferrer">Open profile</a>}
                                <button className="flow__ghost" onClick={() => navigator.clipboard.writeText(type === 'code' ? it.code : it.body)}>Copy</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {ag.length > 0 && (
                    <details className="mc__msdetails" style={{ marginTop: '0.9rem' }}>
                      <summary>Agent outputs ({ag.length})</summary>
                      {ag.map((a) => (
                        <div key={a.id} style={{ marginTop: '0.6rem' }}>
                          <div className="mc__resulthead">
                            <span className="admin__label" style={{ margin: 0 }}>{a.emoji} {a.name}{a.ms ? ` · ${fmtMs(a.ms)}` : ''}</span>
                            <button className="fnode__copy" onClick={() => navigator.clipboard.writeText(a.result)}>copy</button>
                          </div>
                          <div className="admin__output" style={{ whiteSpace: 'pre-wrap', maxHeight: '200px', overflow: 'auto' }}>{a.result}</div>
                        </div>
                      ))}
                    </details>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })()}

      {viewing && (
        <div className="modal__backdrop" onClick={() => setViewing(null)}>
          <div className="modal__card" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <h3 className="admin__title">{viewing.name}</h3>
              <span>
                <button className="fnode__copy" onClick={() => navigator.clipboard.writeText(viewing.text)}>copy</button>
                <button className="modal__close" onClick={() => setViewing(null)}>×</button>
              </span>
            </div>
            <div className="admin__output" style={{ whiteSpace: 'pre-wrap' }}>{viewing.text}</div>
          </div>
        </div>
      )}

      {showProfile && (
        <div className="modal__backdrop" onClick={() => setShowProfile(false)}>
          <div className="modal__card" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <h3 className="admin__title">HAL.md</h3>
              <button className="modal__close" onClick={() => setShowProfile(false)}>×</button>
            </div>
            <p className="admin__muted">Every agent, the Commander, the Analyst and the Dispatcher all read this first. It is who you are, your proof, your voice and what works. Keep it lean. It grows through Critique &amp; learn.</p>
            <textarea className="admin__textarea" rows={14} value={profile} onChange={(e) => setProfile(e.target.value)} />
            <div className="mc__outactions" style={{ marginTop: '0.6rem' }}>
              <button className="admin__btn" style={{ marginTop: 0, width: 'auto', paddingLeft: '1.2rem', paddingRight: '1.2rem' }} onClick={() => setShowProfile(false)}>Done</button>
              <button className="flow__ghost" onClick={() => { if (window.confirm('Replace your HAL.md with the starter template?')) setProfile(SOUL_TEMPLATE); }}>Load template</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}