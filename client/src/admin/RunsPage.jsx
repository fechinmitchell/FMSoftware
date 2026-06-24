import { useState } from 'react';
import { STARTERS, flowToSteps } from './FlowBuilder';

const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const LIB_KEY = 'fm_flows';

function loadLibrary() {
  try { return JSON.parse(localStorage.getItem(LIB_KEY) || '[]'); } catch { return []; }
}

export default function RunsPage({ token }) {
  const saved = loadLibrary();
  const all = [...STARTERS.map((s) => ({ ...s, builtin: true })), ...saved];

  return (
    <section className="admin__card">
      <div className="admin__toolhead">
        <div>
          <h2 className="admin__title">Run Agent</h2>
          <p className="admin__muted">Every saved agent, one click to run. View the output when it's done. Build and save them in Agent Flow.</p>
        </div>
      </div>
      <div className="runs">
        {all.map((flow) => <RunRow key={flow.id} flow={flow} token={token} />)}
      </div>
    </section>
  );
}

function RunRow({ flow, token }) {
  const compiled = flowToSteps(flow.nodes, flow.edges) || { input: '', steps: [] };
  const [input, setInput] = useState(compiled.input);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  const summary = compiled.steps.map((s) => s.type).join(' → ') || 'no steps';
  const status = error ? 'err' : results ? 'ok' : '';

  async function run() {
    setError(''); setBusy(true);
    try {
      const r = await fetch(`${API}/api/admin/workflow/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ input, steps: compiled.steps }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error || 'Run failed.'); setResults(null); setOpen(true); return; }
      setResults(data.results || []); setOpen(true);
    } catch {
      setError('Could not reach the server.'); setResults(null); setOpen(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="runs__row">
        <div className="runs__meta">
          <div className="runs__name">
            {flow.name}
            {flow.builtin && <span className="runs__tag">ready-made</span>}
          </div>
          <div className="runs__sub">{compiled.steps.length} steps · {summary}</div>
        </div>
        <div className="runs__rowbtns">
          {status === 'ok' && <span className="runs__dot runs__dot--ok" title="last run ok" />}
          {status === 'err' && <span className="runs__dot runs__dot--err" title="last run errored" />}
          <button className="runs__view" onClick={() => setOpen(true)} disabled={!results && !error}>View output</button>
          <button className="admin__btn runs__run" onClick={run} disabled={busy || compiled.steps.length === 0}>
            {busy ? 'Running…' : 'Run'}
          </button>
        </div>
      </div>

      {open && (
        <div className="modal__backdrop" onClick={() => setOpen(false)}>
          <div className="modal__card" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <h3 className="admin__title">{flow.name}</h3>
              <button className="modal__close" onClick={() => setOpen(false)}>×</button>
            </div>

            <label className="admin__label">Input <span>edit and run again to try a different value</span></label>
            <textarea className="admin__textarea admin__textarea--sm" rows={2} value={input} onChange={(e) => setInput(e.target.value)} />

            {error && <p className="admin__error">{error}</p>}

            <button className="admin__btn" onClick={run} disabled={busy}>
              {busy ? 'Running…' : 'Run again'}
            </button>

            {results && (
              <div className="admin__results">
                {results.map((res, i) => (
                  <div className="admin__field" key={i}>
                    <div className="admin__fieldhead">
                      <span className="admin__label">{res.name} <span style={{ fontWeight: 400 }}>· {res.type} · {res.ms}ms</span></span>
                      {res.output && <CopyBtn text={res.output} />}
                    </div>
                    <div className={`admin__output${res.error ? ' admin__output--err' : ''}`}>
                      {res.error ? `Error: ${res.error}` : res.output}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function CopyBtn({ text }) {
  const [done, setDone] = useState(false);
  return (
    <button className="admin__copy" onClick={() => { navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1200); }}>
      {done ? 'Copied' : 'Copy'}
    </button>
  );
}