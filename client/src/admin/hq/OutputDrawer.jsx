// ------------------------------------------------------------------
//  Output drawer — slides in from the right over the dimmed floor.
// ------------------------------------------------------------------
import { useState } from 'react';
import { modelLabel } from './hqStore';

function SaveBtn({ hq, agentId, run }) {
  const saved = (hq.state.library || []).some((x) => x.runId === run.id);
  return (
    <button className="admin__copy" disabled={saved} title="saves to the Outputs page and analyses it into action steps"
      onClick={() => hq.saveOutput(agentId, run.id)}>
      {saved ? 'Saved ✓ → Outputs tab' : '💾 Save output'}
    </button>
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

export default function OutputDrawer({ hq, agentId, runId, onClose }) {
  const agent = hq.state.agents.find((a) => a.id === agentId);
  if (!agent) return null;
  const runs = [...agent.runs].reverse();
  const [sel, setSel] = useState(runId || (runs[0] && runs[0].id));
  const run = runs.find((r) => r.id === sel) || runs[0];
  const pendingDraft = hq.state.approvals.find((x) => x.agentId === agentId && x.status === 'pending');

  return (
    <div className="hq-drawerwrap" onClick={onClose}>
      <aside className="hq-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="hq-drawer__head">
          <div>
            <div className="hq-drawer__title">{agent.emoji} {agent.name} — output</div>
            {run && (
              <div className="hq-drawer__meta">
                {new Date(run.at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                {' · '}v{run.v} · {modelLabel(run.model)} · ${(run.costUSD || 0).toFixed(2)}
                {run.reason ? <span title="why the Kensei picked this model"> · {run.reason}</span> : null}
              </div>
            )}
          </div>
          <button className="modal__close" onClick={onClose}>×</button>
        </div>

        {runs.length > 1 && (
          <select className="fnode__model" value={sel} onChange={(e) => setSel(e.target.value)}>
            {runs.map((r) => (
              <option key={r.id} value={r.id}>
                {new Date(r.at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · v{r.v}{r.error ? ' · error' : ''}
              </option>
            ))}
          </select>
        )}

        {!run && <p className="admin__muted">No runs yet. Hit Run on this agent first.</p>}

        {run && run.error && <div className="admin__output admin__output--err">{run.error}</div>}

        {run && !run.error && (
          <>
            {pendingDraft && agent.kind === 'blog' && (
              <p className="hq-drawer__notice">📥 This draft is waiting in Approvals — approve it there to publish to fmsoftware.ie/blog.</p>
            )}
            <div className="hq-drawer__outhead">
              <span className="admin__label" style={{ margin: 0 }}>result</span>
              <span style={{ display: 'flex', gap: '0.4rem' }}>
                <SaveBtn hq={hq} agentId={agentId} run={run} />
                <CopyBtn text={run.output} />
              </span>
            </div>
            <div className="admin__output hq-drawer__out">{run.output}</div>
            {run.sources && run.sources.length > 0 && (
              <div className="hq-drawer__sources">
                <span className="admin__label">sources</span>
                {run.sources.slice(0, 8).map((s, i) => (
                  <a key={i} className="mc__source" href={s.url} target="_blank" rel="noreferrer">{s.title || s.url}</a>
                ))}
              </div>
            )}
          </>
        )}
      </aside>
    </div>
  );
}