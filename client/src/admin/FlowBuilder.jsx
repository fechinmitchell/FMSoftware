import { useCallback, useRef, useState, createContext, useContext } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './FlowBuilder.css';

const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

/* update(id, patch) is shared to every node via context so nodes can edit themselves */
const NodeApi = createContext(() => {});

/* ------------------------------------------------------------------ */
/*  Custom nodes                                                      */
/* ------------------------------------------------------------------ */
function InputNode({ id, data }) {
  const update = useContext(NodeApi);
  return (
    <div className="fnode fnode--input">
      <div className="fnode__head"><span className="fnode__type fnode__type--input">input</span></div>
      <textarea
        className="fnode__field nodrag" rows={2}
        placeholder="starting value, e.g. a URL"
        value={data.value || ''}
        onChange={(e) => update(id, { value: e.target.value })}
      />
      <div className="fnode__ref">use as {'{{input}}'}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function FetchNode({ id, data }) {
  const update = useContext(NodeApi);
  return (
    <div className="fnode fnode--fetch">
      <Handle type="target" position={Position.Left} />
      <div className="fnode__head">
        <span className="fnode__type fnode__type--fetch">fetch</span>
        <input className="fnode__name nodrag" value={data.name}
          onChange={(e) => update(id, { name: e.target.value.replace(/[^\w]/g, '') })} />
      </div>
      <input className="fnode__field nodrag" placeholder="https://… or {{input}}"
        value={data.url || ''} onChange={(e) => update(id, { url: e.target.value })} />
      <NodeResult data={data} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function LlmNode({ id, data }) {
  const update = useContext(NodeApi);
  return (
    <div className="fnode fnode--llm">
      <Handle type="target" position={Position.Left} />
      <div className="fnode__head">
        <span className="fnode__type fnode__type--llm">llm</span>
        <input className="fnode__name nodrag" value={data.name}
          onChange={(e) => update(id, { name: e.target.value.replace(/[^\w]/g, '') })} />
      </div>
      <textarea className="fnode__field nodrag" rows={2} placeholder="system (optional)"
        value={data.system || ''} onChange={(e) => update(id, { system: e.target.value })} />
      <textarea className="fnode__field nodrag" rows={4} placeholder="prompt — pull earlier steps with {{name}}"
        value={data.prompt || ''} onChange={(e) => update(id, { prompt: e.target.value })} />
      <NodeResult data={data} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function NodeResult({ data }) {
  if (data.error) return <div className="fnode__result fnode__result--err nowheel">{data.error}</div>;
  if (data.result) return <div className="fnode__result nowheel">{data.result}</div>;
  return null;
}

const nodeTypes = { input: InputNode, fetch: FetchNode, llm: LlmNode };

/* ------------------------------------------------------------------ */
/*  Seed: the example chain, already wired                            */
/* ------------------------------------------------------------------ */
const seedNodes = [
  { id: 'input', type: 'input', position: { x: 0, y: 140 }, data: { value: 'https://example.com' } },
  { id: 'n1', type: 'fetch', position: { x: 240, y: 60 }, data: { name: 'site', url: '{{input}}' } },
  { id: 'n2', type: 'llm', position: { x: 520, y: 20 }, data: {
    name: 'pain',
    system: 'You are a sharp B2B analyst. No hyphens, no Oxford commas.',
    prompt: 'Here is a company website:\n\n{{site}}\n\nIn 4 short bullets, what do they do and where might they lose time to manual work software could fix?',
  } },
  { id: 'n3', type: 'llm', position: { x: 820, y: 60 }, data: {
    name: 'pitch',
    system: 'You write warm direct outreach for a freelance software contractor. No hyphens, no Oxford commas. Under 120 words.',
    prompt: 'Based on this:\n\n{{pain}}\n\nWrite a short cold email pitching myself as the contractor who builds the fix. I run FM Software, a one person studio in Galway.',
  } },
];
const seedEdges = [
  { id: 'e1', source: 'input', target: 'n1' },
  { id: 'e2', source: 'n1', target: 'n2' },
  { id: 'e3', source: 'n2', target: 'n3' },
];

/* ------------------------------------------------------------------ */
/*  Topological sort — the actual lesson                              */
/*  Returns an order where every node comes after its feeders,        */
/*  or null if there is a loop.                                       */
/* ------------------------------------------------------------------ */
function topoSort(nodes, edges) {
  const indeg = {}, adj = {};
  nodes.forEach((n) => { indeg[n.id] = 0; adj[n.id] = []; });
  edges.forEach((e) => {
    if (adj[e.source] && indeg[e.target] !== undefined) {
      adj[e.source].push(e.target);
      indeg[e.target]++;
    }
  });
  const queue = nodes.filter((n) => indeg[n.id] === 0).map((n) => n.id);
  const order = [];
  while (queue.length) {
    const id = queue.shift();
    order.push(id);
    adj[id].forEach((t) => { if (--indeg[t] === 0) queue.push(t); });
  }
  return order.length === nodes.length ? order : null; // null => cycle
}

/* ------------------------------------------------------------------ */
/*  Canvas                                                            */
/* ------------------------------------------------------------------ */
function FlowInner({ token }) {
  const [nodes, setNodes, onNodesChange] = useNodesState(seedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(seedEdges);
  const { screenToFlowPosition } = useReactFlow();
  const idRef = useRef(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

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
    const data = type === 'fetch'
      ? { name: `fetch${n}`, url: '{{input}}' }
      : { name: `llm${n}`, system: '', prompt: '' };
    setNodes((nds) => nds.concat({ id, type, position, data }));
  }, [screenToFlowPosition, setNodes]);

  async function run() {
    setError('');
    const order = topoSort(nodes, edges);
    if (!order) { setError('Your graph has a loop. Remove a connection and try again.'); return; }

    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
    const inputNode = nodes.find((n) => n.type === 'input');
    const steps = order
      .map((id) => byId[id])
      .filter((n) => n.type !== 'input')
      .map((n) => ({ name: n.data.name, type: n.type, url: n.data.url, system: n.data.system, prompt: n.data.prompt }));

    // clear previous results
    setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, result: undefined, error: undefined } })));
    setBusy(true);
    try {
      const r = await fetch(`${API}/api/admin/workflow/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ input: inputNode?.data.value || '', steps }),
      });
      const res = await r.json();
      if (!r.ok) { setError(res.error || 'Run failed.'); return; }
      const byName = {};
      (res.results || []).forEach((x) => { byName[x.name] = x; });
      setNodes((nds) => nds.map((n) => {
        const x = byName[n.data.name];
        return x ? { ...n, data: { ...n.data, result: x.output, error: x.error } } : n;
      }));
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <NodeApi.Provider value={update}>
      <div className="flow__bar">
        <div className="flow__palette">
          <span className="flow__paltitle">drag onto canvas:</span>
          <PaletteItem type="fetch" label="fetch" />
          <PaletteItem type="llm" label="llm" />
        </div>
        <button className="admin__btn flow__run" onClick={run} disabled={busy}>
          {busy ? 'Running…' : 'Run workflow'}
        </button>
      </div>
      {error && <p className="admin__error">{error}</p>}

      <div className="flow__wrap" onDragOver={onDragOver} onDrop={onDrop}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={18} />
          <Controls />
          <MiniMap pannable zoomable />
        </ReactFlow>
      </div>
      <p className="admin__muted flow__hint">
        Drag from a node's right dot to the next node's left dot to wire them. The wiring sets the run order. Inside a prompt, pull an earlier step's output with {'{{name}}'}.
      </p>
    </NodeApi.Provider>
  );
}

function PaletteItem({ type, label }) {
  return (
    <div
      className={`flow__palitem flow__palitem--${type}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/fmnode', type);
        e.dataTransfer.effectAllowed = 'move';
      }}
    >
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