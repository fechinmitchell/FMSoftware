import { useCallback, useRef, useState, createContext, useContext } from 'react';
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  Handle, Position, addEdge, useNodesState, useEdgesState, useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './FlowBuilder.css';

const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const LIB_KEY = 'fm_flows';

const MODELS = [
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5', note: 'fastest + cheapest — classifying, short drafts, simple extraction' },
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6', note: 'balanced default — most drafting and analysis' },
  { id: 'claude-opus-4-8', label: 'Opus 4.8', note: 'most capable — hard reasoning, complex multi-step' },
];

const NODE_INFO = {
  input: 'The single starting value for the whole workflow. Everything downstream reads it as {{input}}. Usually a URL, a name, or a chunk of text you paste in.',
  fetch: 'Downloads a web page and strips it to clean text. Point it at a company site, an article, a tender listing — any public URL. Its output becomes available to later nodes as {{name}}.',
  llm: 'Sends a prompt to Claude and returns the answer. Pull earlier steps in with {{name}}. Pick the model to match the job: Haiku for speed and cost, Sonnet for balance, Opus for the hardest reasoning.',
  template: 'Merges variables into a block of text. No model call, so it is free and instant. Great for assembling a final message or stitching several outputs together.',
};

const CATEGORIES = [
  { name: 'Triggers', detail: 'Start a flow on their own — a schedule, a webhook, an incoming email.', status: 'next: schedule' },
  { name: 'App connectors', detail: 'Do something in a real service — Gmail, Slack, Sheets, Notion, Stripe.', status: 'later' },
  { name: 'HTTP request', detail: 'Call any API that has no dedicated node.', status: 'you have it: fetch' },
  { name: 'Logic', detail: 'Branch and control flow — IF, Switch, Merge, Loop.', status: 'next: branch' },
  { name: 'Transform', detail: 'Reshape data between steps — Set, Filter, Code.', status: 'you have it: template' },
  { name: 'AI', detail: 'Model calls and agents — LLM, tools agent, memory.', status: 'you have it: llm' },
];

const NodeApi = createContext(() => {});

/* ------------------------------------------------------------------ */
/*  Shared pieces                                                     */
/* ------------------------------------------------------------------ */
function InfoBtn({ type }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="fnode__info">
      <button className="fnode__infobtn nodrag" onClick={() => setOpen((o) => !o)} title="What does this do?">i</button>
      {open && <span className="fnode__infobox nowheel">{NODE_INFO[type]}</span>}
    </span>
  );
}

function CopyMini({ text }) {
  const [done, setDone] = useState(false);
  return (
    <button className="fnode__copy nodrag" onClick={() => { navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1200); }}>
      {done ? 'copied' : 'copy'}
    </button>
  );
}

function NodeResult({ data }) {
  if (data.status === 'running') return <div className="fnode__running">running…</div>;
  if (data.error) return <div className="fnode__result fnode__result--err nowheel">{data.error}</div>;
  if (data.result) return (
    <div className="fnode__resultwrap">
      <div className="fnode__result nowheel">{data.result}</div>
      <CopyMini text={data.result} />
    </div>
  );
  return null;
}

/* ------------------------------------------------------------------ */
/*  Nodes                                                             */
/* ------------------------------------------------------------------ */
function InputNode({ id, data }) {
  const update = useContext(NodeApi);
  return (
    <div className={`fnode fnode--input ${data.status === 'running' ? 'fnode--running-b' : ''}`}>
      <div className="fnode__head"><span className="fnode__type fnode__type--input">input</span><InfoBtn type="input" /></div>
      <textarea className="fnode__field nodrag" rows={2} placeholder="starting value, e.g. a URL"
        value={data.value || ''} onChange={(e) => update(id, { value: e.target.value })} />
      <div className="fnode__ref">use as {'{{input}}'}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function FetchNode({ id, data }) {
  const update = useContext(NodeApi);
  return (
    <div className={`fnode fnode--fetch ${data.status === 'running' ? 'fnode--running-b' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <div className="fnode__head">
        <span className="fnode__type fnode__type--fetch">fetch</span>
        <input className="fnode__name nodrag" value={data.name} onChange={(e) => update(id, { name: e.target.value.replace(/[^\w]/g, '') })} />
        <InfoBtn type="fetch" />
      </div>
      <input className="fnode__field nodrag" placeholder="https://… or {{input}}" value={data.url || ''} onChange={(e) => update(id, { url: e.target.value })} />
      <NodeResult data={data} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function LlmNode({ id, data }) {
  const update = useContext(NodeApi);
  return (
    <div className={`fnode fnode--llm ${data.status === 'running' ? 'fnode--running-b' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <div className="fnode__head">
        <span className="fnode__type fnode__type--llm">llm</span>
        <input className="fnode__name nodrag" value={data.name} onChange={(e) => update(id, { name: e.target.value.replace(/[^\w]/g, '') })} />
        <InfoBtn type="llm" />
      </div>
      <select className="fnode__model nodrag" value={data.model || 'claude-sonnet-4-6'} onChange={(e) => update(id, { model: e.target.value })}
        title={MODELS.find((m) => m.id === (data.model || 'claude-sonnet-4-6'))?.note}>
        {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
      </select>
      <textarea className="fnode__field nodrag" rows={2} placeholder="system (optional)" value={data.system || ''} onChange={(e) => update(id, { system: e.target.value })} />
      <textarea className="fnode__field nodrag" rows={4} placeholder="prompt — pull earlier steps with {{name}}" value={data.prompt || ''} onChange={(e) => update(id, { prompt: e.target.value })} />
      <McpFields id={id} data={data} update={update} />
      <NodeResult data={data} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function McpFields({ id, data, update }) {
  const [open, setOpen] = useState(!!data.mcpUrl);
  return (
    <div className="fnode__mcpwrap">
      <button className="fnode__mcptoggle nodrag" onClick={() => setOpen((o) => !o)}>
        {open ? '− tool (MCP)' : '+ tool (MCP)'}
      </button>
      {open && (
        <div className="fnode__mcp">
          <input className="fnode__field nodrag" placeholder="MCP server URL (https://…)" value={data.mcpUrl || ''} onChange={(e) => update(id, { mcpUrl: e.target.value })} />
          <input className="fnode__field nodrag" placeholder="server name, e.g. gmail" value={data.mcpName || ''} onChange={(e) => update(id, { mcpName: e.target.value })} />
          <input className="fnode__field nodrag" placeholder="auth token (optional)" value={data.mcpToken || ''} onChange={(e) => update(id, { mcpToken: e.target.value })} />
        </div>
      )}
    </div>
  );
}

function TemplateNode({ id, data }) {
  const update = useContext(NodeApi);
  return (
    <div className={`fnode fnode--template ${data.status === 'running' ? 'fnode--running-b' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <div className="fnode__head">
        <span className="fnode__type fnode__type--template">template</span>
        <input className="fnode__name nodrag" value={data.name} onChange={(e) => update(id, { name: e.target.value.replace(/[^\w]/g, '') })} />
        <InfoBtn type="template" />
      </div>
      <textarea className="fnode__field nodrag" rows={4} placeholder="text with {{name}} variables — no model call" value={data.template || ''} onChange={(e) => update(id, { template: e.target.value })} />
      <NodeResult data={data} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = { input: InputNode, fetch: FetchNode, llm: LlmNode, template: TemplateNode };

/* ------------------------------------------------------------------ */
/*  Ready-made starter workflows                                      */
/* ------------------------------------------------------------------ */
export const STARTERS = [
  {
    id: 'starter_lead', name: 'Lead research', builtin: true,
    nodes: [
      { id: 'input', type: 'input', data: { value: 'https://example.com' } },
      { id: 'n1', type: 'fetch', data: { name: 'site', url: '{{input}}' } },
      { id: 'n2', type: 'llm', data: { name: 'pain', model: 'claude-sonnet-4-6', system: 'You are a sharp B2B analyst. No hyphens, no Oxford commas.', prompt: 'Here is a company website:\n\n{{site}}\n\nIn 4 short bullets, what do they do and where might they lose time to manual work software could fix?' } },
      { id: 'n3', type: 'llm', data: { name: 'pitch', model: 'claude-sonnet-4-6', system: 'You write warm direct outreach for a freelance software contractor. No hyphens, no Oxford commas. Under 120 words.', prompt: 'Based on this:\n\n{{pain}}\n\nWrite a short cold email pitching myself as the contractor who builds the fix. I run FM Software, a one person studio in Galway.' } },
    ],
    edges: [{ source: 'input', target: 'n1' }, { source: 'n1', target: 'n2' }, { source: 'n2', target: 'n3' }],
  },
  {
    id: 'starter_outreach', name: 'Outreach from a posting', builtin: true,
    nodes: [
      { id: 'input', type: 'input', data: { value: 'paste a job posting here' } },
      { id: 'n1', type: 'llm', data: { name: 'needs', model: 'claude-haiku-4-5-20251001', system: 'No hyphens, no Oxford commas.', prompt: 'From this job posting, list the 3 things they most need in plain bullets:\n\n{{input}}' } },
      { id: 'n2', type: 'llm', data: { name: 'email', model: 'claude-sonnet-4-6', system: 'You write warm direct contractor outreach. No hyphens, no Oxford commas. Under 130 words.', prompt: 'They need:\n\n{{needs}}\n\nWrite a short email pitching myself as a contractor who can start in weeks. I run FM Software in Galway, I build automation and AI tools.' } },
    ],
    edges: [{ source: 'input', target: 'n1' }, { source: 'n1', target: 'n2' }],
  },
  {
    id: 'starter_tender', name: 'Tender summary', builtin: true,
    nodes: [
      { id: 'input', type: 'input', data: { value: 'https://www.etenders.gov.ie' } },
      { id: 'n1', type: 'fetch', data: { name: 'page', url: '{{input}}' } },
      { id: 'n2', type: 'llm', data: { name: 'summary', model: 'claude-sonnet-4-6', system: 'You assess public tenders for a small software studio. No hyphens, no Oxford commas.', prompt: 'From this tender page, pull: what they want, rough value, deadline, and whether a one person software studio could realistically bid. Be blunt about fit.\n\n{{page}}' } },
    ],
    edges: [{ source: 'input', target: 'n1' }, { source: 'n1', target: 'n2' }],
  },
  {
    id: 'starter_competitor', name: 'Competitor scan', builtin: true,
    nodes: [
      { id: 'input', type: 'input', data: { value: 'https://competitor.com' } },
      { id: 'n1', type: 'fetch', data: { name: 'site', url: '{{input}}' } },
      { id: 'n2', type: 'llm', data: { name: 'scan', model: 'claude-sonnet-4-6', system: 'You are a product strategist. No hyphens, no Oxford commas.', prompt: 'From this competitor site, summarise what they offer, who they target, any pricing shown, and gaps a small studio could exploit.\n\n{{site}}' } },
    ],
    edges: [{ source: 'input', target: 'n1' }, { source: 'n1', target: 'n2' }],
  },
  {
    id: 'starter_content', name: 'Content repurpose', builtin: true,
    nodes: [
      { id: 'input', type: 'input', data: { value: 'describe the tool you just built' } },
      { id: 'n1', type: 'llm', data: { name: 'linkedin', model: 'claude-sonnet-4-6', system: 'You write build in public posts for a solo dev. No hyphens, no Oxford commas. Lead with the business outcome.', prompt: 'Write a short LinkedIn post about this build, aimed at potential clients not other developers:\n\n{{input}}' } },
      { id: 'n2', type: 'llm', data: { name: 'youtube', model: 'claude-haiku-4-5-20251001', system: 'No hyphens, no Oxford commas.', prompt: 'Write a YouTube description and 5 tags for a build video about:\n\n{{input}}' } },
      { id: 'n3', type: 'template', data: { name: 'bundle', template: 'LINKEDIN\n{{linkedin}}\n\nYOUTUBE\n{{youtube}}' } },
    ],
    edges: [{ source: 'input', target: 'n1' }, { source: 'input', target: 'n2' }, { source: 'n1', target: 'n3' }, { source: 'n2', target: 'n3' }],
  },
];

/* ------------------------------------------------------------------ */
/*  Graph helpers                                                     */
/* ------------------------------------------------------------------ */
export function topoSort(nodes, edges) {
  const indeg = {}, adj = {};
  nodes.forEach((n) => { indeg[n.id] = 0; adj[n.id] = []; });
  edges.forEach((e) => { if (adj[e.source] && indeg[e.target] !== undefined) { adj[e.source].push(e.target); indeg[e.target]++; } });
  const queue = nodes.filter((n) => indeg[n.id] === 0).map((n) => n.id);
  const order = [];
  while (queue.length) { const id = queue.shift(); order.push(id); adj[id].forEach((t) => { if (--indeg[t] === 0) queue.push(t); }); }
  return order.length === nodes.length ? order : null;
}

/* turn a saved graph into {input, steps} the engine runs — shared with the Run page */
export function flowToSteps(nodes, edges) {
  const order = topoSort(nodes, edges);
  if (!order) return null;
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const inputNode = nodes.find((n) => n.type === 'input');
  const steps = order.map((id) => byId[id]).filter((n) => n.type !== 'input').map((n) => ({
    name: n.data.name, type: n.type, url: n.data.url, system: n.data.system, prompt: n.data.prompt, template: n.data.template, model: n.data.model,
  }));
  return { input: inputNode?.data.value || '', steps };
}

function autoLayout(nodes, edges) {
  const adj = {}, depth = {};
  nodes.forEach((n) => { adj[n.id] = []; depth[n.id] = 0; });
  edges.forEach((e) => { if (adj[e.source]) adj[e.source].push(e.target); });
  const order = topoSort(nodes, edges) || nodes.map((n) => n.id);
  order.forEach((id) => adj[id]?.forEach((t) => { depth[t] = Math.max(depth[t], (depth[id] || 0) + 1); }));
  const perCol = {};
  return nodes.map((n) => {
    const d = depth[n.id] || 0; const row = perCol[d] || 0; perCol[d] = row + 1;
    return { ...n, position: { x: d * 300, y: row * 220 } };
  });
}

function cleanNodes(nds) {
  return nds.map(({ id, type, position, data }) => {
    const { result, error, status, ...d } = data || {};
    return { id, type, position, data: d };
  });
}
function loadLibrary() { try { return JSON.parse(localStorage.getItem(LIB_KEY) || '[]'); } catch { return []; } }

/* ------------------------------------------------------------------ */
/*  Canvas                                                            */
/* ------------------------------------------------------------------ */
function FlowInner({ token }) {
  const [nodes, setNodes, onNodesChange] = useNodesState(autoLayout(JSON.parse(JSON.stringify(STARTERS[0].nodes)), STARTERS[0].edges));
  const [edges, setEdges, onEdgesChange] = useEdgesState(STARTERS[0].edges.map((e, i) => ({ id: `se${i}`, ...e })));
  const { screenToFlowPosition, fitView } = useReactFlow();
  const refit = () => setTimeout(() => { try { fitView({ duration: 300 }); } catch {} }, 60);
  const idRef = useRef(10);
  const abortRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [genBusy, setGenBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [desc, setDesc] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [showLib, setShowLib] = useState(false);
  const [library, setLibrary] = useState(loadLibrary);

  const update = useCallback((id, patch) => {
    setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)));
  }, [setNodes]);

  const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  const onDragOver = useCallback((e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }, []);
  const onDrop = useCallback((e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('application/fmnode');
    if (!type) return;
    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const n = idRef.current++;
    const id = `node_${n}`;
    let data;
    if (type === 'fetch') data = { name: `fetch${n}`, url: '{{input}}' };
    else if (type === 'template') data = { name: `text${n}`, template: '' };
    else data = { name: `llm${n}`, system: '', prompt: '', model: 'claude-sonnet-4-6' };
    setNodes((nds) => nds.concat({ id, type, position, data }));
  }, [screenToFlowPosition, setNodes]);

  /* ---- AI generate ---- */
  async function generate() {
    if (!desc.trim()) return;
    setError(''); setStatus(''); setGenBusy(true);
    try {
      const r = await fetch(`${API}/api/admin/workflow/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ description: desc }),
      });
      const g = await r.json();
      if (!r.ok) { setError(g.error || 'Generate failed.'); return; }
      const rfNodes = g.nodes.map((n) => ({
        id: n.id,
        type: ['input', 'fetch', 'llm', 'template'].includes(n.type) ? n.type : 'llm',
        position: { x: 0, y: 0 },
        data: n.type === 'input' ? { value: n.value || '' }
          : n.type === 'fetch' ? { name: n.name, url: n.url || '{{input}}' }
          : n.type === 'template' ? { name: n.name, template: n.template || '' }
          : { name: n.name, system: n.system || '', prompt: n.prompt || '', model: n.model || 'claude-sonnet-4-6' },
      }));
      const rfEdges = (g.edges || []).map((e, i) => ({ id: `ge${i}`, source: e.source, target: e.target }));
      setNodes(autoLayout(rfNodes, rfEdges));
      setEdges(rfEdges);
      setStatus('Built. Tweak it, then Run.'); refit();
    } catch { setError('Could not reach the server.'); }
    finally { setGenBusy(false); }
  }

  /* ---- run (live) / stop ---- */
  async function run() {
    setError(''); setStatus('');
    const order = topoSort(nodes, edges);
    if (!order) { setError('Your graph has a loop. Remove a connection and try again.'); return; }
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
    const inputNode = nodes.find((n) => n.type === 'input');
    const steps = order.map((id) => byId[id]).filter((n) => n.type !== 'input').map((n) => ({
      name: n.data.name, type: n.type, url: n.data.url, system: n.data.system, prompt: n.data.prompt, template: n.data.template, model: n.data.model,
      mcp: n.data.mcpUrl ? { url: n.data.mcpUrl, name: n.data.mcpName, token: n.data.mcpToken } : undefined,
    }));
    const nameToId = {};
    nodes.forEach((n) => { if (n.data?.name) nameToId[n.data.name] = n.id; });

    setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, result: undefined, error: undefined, status: undefined } })));
    const ctrl = new AbortController(); abortRef.current = ctrl;
    setBusy(true); setStatus('Running…');
    try {
      const r = await fetch(`${API}/api/admin/workflow/run-stream`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ input: inputNode?.data.value || '', steps }), signal: ctrl.signal,
      });
      if (!r.ok || !r.body) { const e = await r.json().catch(() => ({})); setError(e.error || 'Run failed.'); return; }
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          let msg; try { msg = JSON.parse(line); } catch { continue; }
          if (msg.event === 'start') { const id = nameToId[msg.name]; if (id) update(id, { status: 'running' }); setStatus(`Running ${msg.name}…`); }
          else if (msg.event === 'step') { const id = nameToId[msg.name]; if (id) update(id, { status: undefined, result: msg.output, error: msg.error }); }
          else if (msg.event === 'done') setStatus('Done.');
          else if (msg.event === 'cancelled') setStatus('Stopped.');
          else if (msg.event === 'error') setError(msg.error);
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') setStatus('Stopped.');
      else setError('Could not reach the server.');
    } finally {
      setBusy(false); abortRef.current = null;
      setNodes((nds) => nds.map((n) => (n.data?.status ? { ...n, data: { ...n.data, status: undefined } } : n)));
    }
  }
  function stop() { abortRef.current?.abort(); }

  /* ---- library: save / load / new / delete ---- */
  function saveFlow() {
    const name = window.prompt('Name this workflow', 'My workflow');
    if (!name) return;
    const flow = { id: 'wf_' + Date.now(), name, nodes: cleanNodes(nodes), edges: edges.map(({ id, source, target }) => ({ id, source, target })) };
    const next = [...library.filter((f) => f.name !== name), flow];
    setLibrary(next); localStorage.setItem(LIB_KEY, JSON.stringify(next)); setStatus(`Saved “${name}”.`);
  }
  function loadFlow(flow, auto) {
    const ns = (flow.nodes || []).map((n) => ({ ...n, data: { ...n.data } }));
    setNodes(auto ? autoLayout(ns, flow.edges || []) : ns);
    setEdges((flow.edges || []).map((e, i) => ({ id: e.id || `le${i}`, source: e.source, target: e.target })));
    setStatus(`Loaded “${flow.name}”.`); setShowLib(false); setError(''); refit();
  }
  function deleteFlow(id) {
    const next = library.filter((f) => f.id !== id);
    setLibrary(next); localStorage.setItem(LIB_KEY, JSON.stringify(next));
  }
  function newFlow() {
    setNodes([{ id: 'input', type: 'input', position: { x: 0, y: 200 }, data: { value: '' } }]);
    setEdges([]); setStatus('New canvas.'); setError(''); refit();
  }

  return (
    <NodeApi.Provider value={update}>
      <div className="flow__gen">
        <input className="admin__input flow__geninput" placeholder="Describe a workflow and let AI build it — e.g. read a company site and draft me a cold email"
          value={desc} onChange={(e) => setDesc(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && generate()} />
        <button className="admin__btn flow__genbtn" onClick={generate} disabled={genBusy || !desc.trim()}>{genBusy ? 'Building…' : 'Generate'}</button>
      </div>

      <div className="flow__bar">
        <div className="flow__palette">
          <span className="flow__paltitle">drag on:</span>
          <PaletteItem type="fetch" label="fetch" />
          <PaletteItem type="llm" label="llm" />
          <PaletteItem type="template" label="template" />
          <button className="flow__help" onClick={() => { setShowLib((s) => !s); setShowHelp(false); }}>templates</button>
          <button className="flow__help" onClick={() => { setShowHelp((s) => !s); setShowLib(false); }}>ⓘ node types</button>
        </div>
        <div className="flow__actions">
          <button className="flow__ghost" onClick={newFlow}>New</button>
          <button className="flow__ghost" onClick={saveFlow}>Save</button>
          {busy
            ? <button className="admin__btn flow__stop" onClick={stop}>Stop</button>
            : <button className="admin__btn flow__run" onClick={run}>Run workflow</button>}
        </div>
      </div>

      {status && <p className="flow__status">{status}</p>}
      {error && <p className="admin__error">{error}</p>}

      {showLib && (
        <div className="flow__helppanel">
          <p className="admin__label" style={{ marginTop: 0 }}>Ready-made workflows — click to load</p>
          <div className="flow__libgrid">
            {STARTERS.map((s) => (
              <button key={s.id} className="flow__libcard" onClick={() => loadFlow(s, true)}>{s.name}</button>
            ))}
          </div>
          {library.length > 0 && (
            <>
              <p className="admin__label">Your saved workflows</p>
              {library.map((f) => (
                <div className="flow__librow" key={f.id}>
                  <button className="flow__libname" onClick={() => loadFlow(f, false)}>{f.name}</button>
                  <button className="fnode__copy" onClick={() => deleteFlow(f.id)}>delete</button>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {showHelp && (
        <div className="flow__helppanel">
          <p className="admin__label" style={{ marginTop: 0 }}>The building blocks (n8n has the same six categories)</p>
          {CATEGORIES.map((c) => (
            <div className="flow__cat" key={c.name}>
              <span className="flow__catname">{c.name}</span>
              <span className="flow__catdetail">{c.detail}</span>
              <span className="flow__catstatus">{c.status}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flow__wrap" onDragOver={onDragOver} onDrop={onDrop}>
        <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
          onConnect={onConnect} nodeTypes={nodeTypes} fitView proOptions={{ hideAttribution: true }}>
          <Background gap={18} />
          <Controls />
          <MiniMap pannable zoomable />
        </ReactFlow>
      </div>
      <p className="admin__muted flow__hint">
        Drag from a node's right dot to the next node's left dot to wire them. The wiring sets the run order. Pull an earlier step into any prompt or template with {'{{name}}'}.
      </p>
    </NodeApi.Provider>
  );
}

function PaletteItem({ type, label }) {
  return (
    <div className={`flow__palitem flow__palitem--${type}`} draggable
      onDragStart={(e) => { e.dataTransfer.setData('application/fmnode', type); e.dataTransfer.effectAllowed = 'move'; }}>
      {label}
    </div>
  );
}

export default function FlowBuilder({ token }) {
  return (
    <ReactFlowProvider>
      <FlowInner token={token} />
    </ReactFlowProvider>
  );
}