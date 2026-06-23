import { useState, useEffect } from 'react';

const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const STORE_KEY = 'fm_workflows';

/* a starter chain so the data flow is obvious: fetch a site -> find the pain -> write a pitch */
const EXAMPLE = {
  name: 'Lead research',
  input: 'https://example.com',
  steps: [
    { name: 'site', type: 'fetch', url: '{{input}}' },
    {
      name: 'pain',
      type: 'llm',
      system: 'You are a sharp B2B analyst. No hyphens, no Oxford commas.',
      prompt:
        'Here is the text of a company website:\n\n{{site}}\n\nIn 4 short bullet points, what does this business do and where might they be losing time to manual work that software could fix?',
    },
    {
      name: 'pitch',
      type: 'llm',
      system: 'You write warm, direct outreach for a freelance software contractor. No hyphens, no Oxford commas. Under 120 words.',
      prompt:
        'Based on this analysis:\n\n{{pain}}\n\nWrite a short cold email pitching myself as a contractor who could build the fix. I run FM Software, a one person studio in Galway building automation and AI tools.',
    },
  ],
};

function uid() {
  return Math.random().toString(36).slice(2, 8);
}
function loadSaved() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); } catch { return []; }
}

export default function WorkflowBuilder({ token }) {
  const [name, setName] = useState(EXAMPLE.name);
  const [input, setInput] = useState(EXAMPLE.input);
  const [steps, setSteps] = useState(() => EXAMPLE.steps.map((s) => ({ ...s, _k: uid() })));
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(loadSaved);

  function patchStep(k, patch) {
    setSteps((prev) => prev.map((s) => (s._k === k ? { ...s, ...patch } : s)));
  }
  function addStep(type) {
    const n = steps.length + 1;
    setSteps((prev) => [
      ...prev,
      type === 'fetch'
        ? { _k: uid(), name: `step${n}`, type: 'fetch', url: '{{input}}' }
        : { _k: uid(), name: `step${n}`, type: 'llm', system: '', prompt: '' },
    ]);
  }
  function removeStep(k) { setSteps((prev) => prev.filter((s) => s._k !== k)); }
  function move(k, dir) {
    setSteps((prev) => {
      const i = prev.findIndex((s) => s._k === k);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const copy = [...prev];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  }

  function refsBefore(index) {
    // variables a step can reference: input + every earlier step name
    return ['input', ...steps.slice(0, index).map((s) => s.name).filter(Boolean)];
  }

  async function run() {
    setError(''); setResults([]); setBusy(true);
    try {
      const payload = { input, steps: steps.map(({ _k, ...s }) => s) };
      const r = await fetch(`${API}/api/admin/workflow/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error || 'Run failed.'); return; }
      setResults(data.results || []);
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  }

  function saveWorkflow() {
    const wf = { id: uid(), name, input, steps: steps.map(({ _k, ...s }) => s) };
    const next = [...saved.filter((w) => w.name !== name), wf];
    localStorage.setItem(STORE_KEY, JSON.stringify(next));
    setSaved(next);
  }
  function loadWorkflow(wf) {
    setName(wf.name);
    setInput(wf.input || '');
    setSteps((wf.steps || []).map((s) => ({ ...s, _k: uid() })));
    setResults([]);
  }
  function deleteWorkflow(id) {
    const next = saved.filter((w) => w.id !== id);
    localStorage.setItem(STORE_KEY, JSON.stringify(next));
    setSaved(next);
  }

  return (
    <section className="admin__card">
      <div className="admin__toolhead">
        <div>
          <h2 className="admin__title">Workflow builder</h2>
          <p className="admin__muted">Chain steps together. Each step can use any earlier one with {'{{name}}'}.</p>
        </div>
      </div>

      <label className="admin__label">Workflow name</label>
      <input className="admin__input" value={name} onChange={(e) => setName(e.target.value)} />

      <label className="admin__label">Input <span>the starting value, referenced as {'{{input}}'}</span></label>
      <input className="admin__input" value={input} onChange={(e) => setInput(e.target.value)} />

      <div className="wf__steps">
        {steps.map((s, i) => (
          <div className="wf__step" key={s._k}>
            <div className="wf__stephead">
              <span className={`wf__badge wf__badge--${s.type}`}>{s.type}</span>
              <input
                className="wf__name"
                value={s.name}
                onChange={(e) => patchStep(s._k, { name: e.target.value.replace(/[^\w]/g, '') })}
                title="Reference this step's output as {{name}}"
              />
              <div className="wf__stepbtns">
                <button className="admin__copy" onClick={() => move(s._k, -1)} disabled={i === 0}>↑</button>
                <button className="admin__copy" onClick={() => move(s._k, 1)} disabled={i === steps.length - 1}>↓</button>
                <button className="admin__copy" onClick={() => removeStep(s._k)}>✕</button>
              </div>
            </div>

            <p className="wf__refs">can use: {refsBefore(i).map((r) => `{{${r}}}`).join('  ') || 'nothing yet'}</p>

            {s.type === 'fetch' ? (
              <>
                <label className="admin__label">URL to fetch</label>
                <input className="admin__input" value={s.url} onChange={(e) => patchStep(s._k, { url: e.target.value })} />
              </>
            ) : (
              <>
                <label className="admin__label">System <span>optional, sets the role</span></label>
                <textarea className="admin__textarea admin__textarea--sm" rows={2}
                  value={s.system} onChange={(e) => patchStep(s._k, { system: e.target.value })} />
                <label className="admin__label">Prompt</label>
                <textarea className="admin__textarea" rows={5}
                  value={s.prompt} onChange={(e) => patchStep(s._k, { prompt: e.target.value })} />
              </>
            )}
          </div>
        ))}
      </div>

      <div className="wf__add">
        <button className="admin__copy" onClick={() => addStep('fetch')}>+ fetch step</button>
        <button className="admin__copy" onClick={() => addStep('llm')}>+ llm step</button>
      </div>

      {error && <p className="admin__error">{error}</p>}

      <div className="wf__actions">
        <button className="admin__btn" onClick={run} disabled={busy || steps.length === 0}>
          {busy ? 'Running…' : 'Run workflow'}
        </button>
        <button className="admin__copy" onClick={saveWorkflow}>Save</button>
      </div>

      {results.length > 0 && (
        <div className="admin__results">
          {results.map((r, i) => (
            <div className="admin__field" key={i}>
              <div className="admin__fieldhead">
                <span className="admin__label">
                  {r.name} <span style={{ fontWeight: 400 }}>· {r.type} · {r.ms}ms</span>
                </span>
                {r.output && <CopyBtn text={r.output} />}
              </div>
              <div className={`admin__output${r.error ? ' admin__output--err' : ''}`}>
                {r.error ? `Error: ${r.error}` : r.output}
              </div>
            </div>
          ))}
        </div>
      )}

      {saved.length > 0 && (
        <div className="wf__saved">
          <span className="admin__label">Saved workflows</span>
          {saved.map((w) => (
            <div className="wf__savedrow" key={w.id}>
              <button className="wf__savedname" onClick={() => loadWorkflow(w)}>{w.name}</button>
              <button className="admin__copy" onClick={() => deleteWorkflow(w.id)}>✕</button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function CopyBtn({ text }) {
  const [done, setDone] = useState(false);
  return (
    <button className="admin__copy" onClick={() => {
      navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1400);
    }}>
      {done ? 'Copied' : 'Copy'}
    </button>
  );
}