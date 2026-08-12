// ------------------------------------------------------------------
//  Agent HQ — the home screen. One engine, switchable themes.
// ------------------------------------------------------------------
import { useState } from 'react';
import useHqStore from './hqStore';
import OfficeScene, { SLOTS as OFFICE_SLOTS, VB as OFFICE_VB } from './themes/OfficeTheme';
import DeckScene, { SLOTS as DECK_SLOTS, VB as DECK_VB } from './themes/DeckTheme';
import AgentEditor from './AgentEditor';
import OutputDrawer from './OutputDrawer';
import './hq.css';

const THEMES = {
  office: { label: 'The Office', Scene: OfficeScene, slots: OFFICE_SLOTS, vb: OFFICE_VB },
  deck: { label: 'Command Deck', Scene: DeckScene, slots: DECK_SLOTS, vb: DECK_VB },
};

const pct = (n, total) => `${(n / total) * 100}%`;

function Hotspot({ slot, vb, className = '', children, onClick }) {
  return (
    <div
      className={`hq-hotspot ${className}`}
      style={{ left: pct(slot.x, vb.w), top: pct(slot.y, vb.h), width: pct(slot.w, vb.w), height: pct(slot.h, vb.h) }}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

export default function AgentHQ({ token }) {
  const hq = useHqStore(token);
  const { state, theme, setTheme, viewAgents, pendingApprovals, recentRuns } = hq;
  const T = THEMES[theme] || THEMES.office;

  const [editorId, setEditorId] = useState(null);     // agent id, or 'new'
  const [drawer, setDrawer] = useState(null);         // {agentId, runId?}
  const [showApprovals, setShowApprovals] = useState(false);
  const [showCosts, setShowCosts] = useState(false);
  const [improvingIds, setImprovingIds] = useState(() => new Set());
  const [error, setError] = useState('');

  const run = async (id) => { setError(''); try { await hq.runAgent(id); } catch (e) { setError(e.message); } };
  const openOutput = (id) => setDrawer({ agentId: id });
  const improve = async (id) => {
    setError('');
    setImprovingIds((p) => new Set(p).add(id));
    try { await hq.newVersion(id, ''); }
    catch (e) { setError(e.message); }
    finally { setImprovingIds((p) => { const n = new Set(p); n.delete(id); return n; }); }
  };

  const overflow = viewAgents.slice(T.slots.agents.length);

  return (
    <div className="hq">
      <div className="hq-bar">
        <div>
          <h2 className="admin__title">Agent HQ</h2>
          <p className="admin__muted">Your agents, one floor. Click an agent to open it, hover for quick actions.</p>
        </div>
        <div className="hq-bar__right">
          <button className="hq-cost" title="every model call is logged — click for the breakdown" onClick={() => setShowCosts(true)}>
            💶 ${hq.costs.today.toFixed(2)} today · ${hq.costs.all.toFixed(2)} all time
          </button>
          <button className={`hq-approvebtn ${pendingApprovals.length ? 'hq-approvebtn--hot' : ''}`} onClick={() => setShowApprovals(true)}>
            📥 Approvals{pendingApprovals.length ? ` · ${pendingApprovals.length}` : ''}
          </button>
          <div className="hq-themes">
            {Object.entries(THEMES).map(([id, t]) => (
              <button key={id} className={`hq-themebtn ${theme === id ? 'hq-themebtn--on' : ''}`} onClick={() => setTheme(id)}>{t.label}</button>
            ))}
          </div>
        </div>
      </div>

      {error && <p className="admin__error">{error}</p>}

      <div className={`hq-scene hq-scene--${theme}`}>
        <T.Scene agents={viewAgents} approvalsCount={pendingApprovals.length} recentRuns={recentRuns} />

        {/* shared interactive layer — identical in every theme */}
        {viewAgents.slice(0, T.slots.agents.length).map((a, i) => (
          <Hotspot
            key={a.id} slot={T.slots.agents[i]} vb={T.vb}
            className={T.slots.agents[i].x + T.slots.agents[i].w / 2 > T.vb.w / 2 ? 'hq-hotspot--flip' : ''}
            onClick={() => setEditorId(a.id)}
          >
            <div className="hq-quick" onClick={(e) => e.stopPropagation()}>
              <span className="hq-quick__name">{a.emoji} {a.name}</span>
              <button className="hq-quick__btn hq-quick__btn--run" disabled={a.status === 'running'} onClick={() => run(a.id)}>
                {a.status === 'running' ? 'Running…' : `▶ Run v${a.version}`}
              </button>
              <button className="hq-quick__btn hq-quick__btn--new" disabled={improvingIds.has(a.id)} onClick={() => improve(a.id)}>
                {improvingIds.has(a.id) ? 'Improving…' : `✨ New version → v${a.version + 1}`}
              </button>
              <button className="hq-quick__btn hq-quick__btn--out" disabled={!a.runCount} onClick={() => openOutput(a.id)}>Output</button>
              <button className="hq-quick__btn" onClick={() => setEditorId(a.id)}>Edit</button>
            </div>
          </Hotspot>
        ))}
        <Hotspot slot={T.slots.create} vb={T.vb} className="hq-hotspot--create" onClick={() => setEditorId('new')} />
        <Hotspot slot={T.slots.approvals} vb={T.vb} className="hq-hotspot--create" onClick={() => setShowApprovals(true)} />
      </div>

      {overflow.length > 0 && (
        <div className="hq-overflow">
          {overflow.map((a) => (
            <button key={a.id} className="hq-chip" onClick={() => setEditorId(a.id)}>
              {a.emoji} {a.name} · v{a.version} {a.status === 'running' ? '· running…' : ''}
            </button>
          ))}
        </div>
      )}

      {editorId && (
        <AgentEditor
          hq={hq} token={token}
          agentId={editorId === 'new' ? null : editorId}
          onClose={() => setEditorId(null)}
          onRun={run}
          onOpenOutput={(id, runId) => { setEditorId(null); setDrawer({ agentId: id, runId }); }}
        />
      )}

      {drawer && <OutputDrawer hq={hq} agentId={drawer.agentId} runId={drawer.runId} onClose={() => setDrawer(null)} />}

      {showApprovals && <ApprovalsModal hq={hq} onClose={() => setShowApprovals(false)} />}
      {showCosts && <CostModal hq={hq} onClose={() => setShowCosts(false)} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Costs — every model call, every window                             */
/* ------------------------------------------------------------------ */
function CostModal({ hq, onClose }) {
  const c = hq.costs;
  const rows = [
    ['Today', c.today], ['This week', c.week], ['This month', c.month], ['This year', c.year], ['All time', c.all],
  ];
  const byAgent = [...hq.viewAgents].filter((a) => a.costTotal > 0).sort((x, y) => y.costTotal - x.costTotal);
  return (
    <div className="modal__backdrop" onClick={onClose}>
      <div className="modal__card" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div>
            <h3 className="admin__title">💶 Spend</h3>
            <p className="admin__muted">Every model call counts: runs, routing, kaizen, improving, drafting, ideas.</p>
          </div>
          <button className="modal__close" onClick={onClose}>×</button>
        </div>
        <div className="hq-costgrid">
          {rows.map(([label, v]) => (
            <div key={label} className={`hq-costcell ${label === 'All time' ? 'hq-costcell--all' : ''}`}>
              <span className="hq-costcell__num">${v.toFixed(2)}</span>
              <span className="hq-costcell__label">{label}</span>
            </div>
          ))}
        </div>
        {byAgent.length > 0 && (
          <>
            <p className="admin__label" style={{ marginTop: '1.2rem' }}>By agent — all time</p>
            {byAgent.map((a) => (
              <div key={a.id} className="hq-costagent">
                <span>{a.emoji} {a.name}</span>
                <span className="hq-costagent__bar"><i style={{ width: `${Math.max(4, (a.costTotal / byAgent[0].costTotal) * 100)}%` }} /></span>
                <strong>${a.costTotal.toFixed(2)}</strong>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Approvals                                                          */
/* ------------------------------------------------------------------ */
function ApprovalActions({ item, busy, onApprove, onReject }) {
  const [note, setNote] = useState('');
  return (
    <div className="hq-approval__actions">
      <input className="admin__input hq-approval__note"
        placeholder="optional note — what could be better next time? feeds kaizen.md"
        value={note} onChange={(e) => setNote(e.target.value)} />
      <button className="hq-quick__btn hq-quick__btn--run" disabled={busy} onClick={() => onApprove(item, note.trim())}>
        {busy ? 'Publishing…' : item.kind === 'blogPost' ? '✓ Approve & publish' : '✓ Approve'}
      </button>
      <button className="hq-quick__btn hq-quick__btn--rej" disabled={busy} onClick={() => onReject(item, note.trim())}>✕ Reject</button>
    </div>
  );
}

function ApprovalsModal({ hq, onClose }) {
  const [busyId, setBusyId] = useState(null);
  const items = hq.state.approvals;

  async function doApprove(item, note) {
    setBusyId(item.id);
    try { await hq.approve(item.id, note); } catch {} finally { setBusyId(null); }
  }
  function doReject(item, note) {
    hq.reject(item.id, note);
  }

  return (
    <div className="modal__backdrop" onClick={onClose}>
      <div className="modal__card modal__card--wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div>
            <h3 className="admin__title">📥 Approvals</h3>
            <p className="admin__muted">What the Kensei wants your call on. Notes on approve OR reject go into kaizen.md — even a good post can teach the agent something.</p>
          </div>
          <button className="modal__close" onClick={onClose}>×</button>
        </div>
        {items.length === 0 && <p className="admin__muted">Nothing here yet. Run the Blog Writer and its drafts land here.</p>}
        {items.map((item) => (
          <div key={item.id} className={`hq-approval hq-approval--${item.status}`}>
            <div className="hq-approval__top">
              <span className={`hq-approval__badge hq-approval__badge--${item.kind}`}>{item.kind === 'blogPost' ? 'blog post' : item.kind}</span>
              <strong>{item.title}</strong>
              <span className="hq-approval__meta">{item.agentName} · {new Date(item.at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              <span className={`hq-approval__status hq-approval__status--${item.status}`}>{item.status}</span>
            </div>
            {item.status === 'pending' && (
              <>
                <pre className="hq-approval__body">{item.body}</pre>
                <ApprovalActions item={item} busy={busyId === item.id} onApprove={doApprove} onReject={doReject} />
              </>
            )}
            {item.status === 'published' && item.url && <a className="hq-approval__link" href={item.url} target="_blank" rel="noreferrer">view commit ↗</a>}
            {item.status === 'error' && (
              <>
                <p className="admin__error">Publish failed: {item.note}</p>
                <div className="hq-approval__actions">
                  <button className="hq-quick__btn hq-quick__btn--run" disabled={busyId === item.id} onClick={() => doApprove(item, '')}>
                    {busyId === item.id ? 'Publishing…' : '↻ Retry publish'}
                  </button>
                </div>
              </>
            )}
            {item.status === 'rejected' && item.note && <p className="hq-approval__meta">your note: {item.note}</p>}
          </div>
        ))}
        {hq.state.masterKaizen && (
          <details className="hq-masterkaizen">
            <summary>The Kensei's kaizen.md ({hq.state.masterKaizen.split('\n').length} lessons)</summary>
            <pre className="hq-approval__body">{hq.state.masterKaizen}</pre>
          </details>
        )}
      </div>
    </div>
  );
}