// ------------------------------------------------------------------
//  Agent editor — one editor, two doors:
//  open an existing agent, or create a new one (describe → AI drafts).
// ------------------------------------------------------------------
import { useState } from 'react';
import { MODELS, modelLabel } from './hqStore';

export default function AgentEditor({ hq, agentId, onClose, onRun, onOpenOutput }) {
  const agent = agentId ? hq.state.agents.find((a) => a.id === agentId) : null;
  return agent
    ? <EditExisting hq={hq} agent={agent} onClose={onClose} onRun={onRun} onOpenOutput={onOpenOutput} />
    : <CreateNew hq={hq} onClose={onClose} />;
}

/* ---------------- create: 3-step wizard ---------------- */
/* 1 describe → ✨ enhance   2 pick tools   3 see the loop → accept */

const TOOL_DEFS = [
  { id: 'web', icon: '🔎', name: 'Web search', desc: 'Researches live info online and cites its sources.' },
  { id: 'blog', icon: '📝', name: 'Blog publishing', desc: 'Writes posts → your approval → live on fmsoftware.ie/blog.' },
  { id: 'security', icon: '🛡️', name: 'Repo security scan', desc: 'Fetches a GitHub repo, hunts leaked keys and security holes, reports fixes.' },
  { id: 'learn', icon: '🧠', name: 'Self-learning (kaizen.md)', desc: 'Saves a lesson after every run and gets better by itself.' },
  { id: 'route', icon: '⚙️', name: 'Auto model pick', desc: 'The Kensei picks the cheapest model that will do the job well.' },
];

function CreateNew({ hq, onClose }) {
  const [step, setStep] = useState(1);
  const [desc, setDesc] = useState('');
  const [draft, setDraft] = useState(null);      // {name, emoji, role, task, webSearch, model}
  const [tools, setTools] = useState({ web: false, blog: false, security: false, learn: true, route: true });
  const [target, setTarget] = useState('fechinmitchell/FMSoftware');
  const [busy, setBusy] = useState(false);
  const [ideas, setIdeas] = useState(null);
  const [ideasBusy, setIdeasBusy] = useState(false);
  const [error, setError] = useState('');

  async function getIdeas() {
    setIdeasBusy(true); setError('');
    try { const r = await hq.fetchIdeas(); setIdeas(r.ideas || []); }
    catch (e) { setError(e.message); }
    finally { setIdeasBusy(false); }
  }

  function pickIdea(i) {
    const text = `${i.title} — ${i.pitch}`;
    setDesc(text); setIdeas(null);
    enhance(text);
  }

  async function enhance(withText) {
    const text = typeof withText === 'string' ? withText : desc;
    setBusy(true); setError('');
    try {
      const d = await hq.draftAgent(text);
      setDraft(d);
      // auto-select tools from what the Kensei drafted + what the words suggest
      setTools({
        web: !!d.webSearch,
        blog: /blog|seo|post|article|content|rank|google/i.test(text + ' ' + (d.task || '')),
        security: /secur|leak|vulnerab|api key|scan|audit|pentest/i.test(text + ' ' + (d.task || '')),
        learn: true,
        route: d.model === 'auto' || !d.model,
      });
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  function accept() {
    hq.addAgent({
      name: draft.name, emoji: tools.security && draft.emoji === '🤖' ? '🛡️' : draft.emoji,
      role: draft.role, task: draft.task,
      webSearch: tools.web,
      kind: tools.security ? 'security' : tools.blog ? 'blog' : 'general',
      target: tools.security ? target.trim() : '',
      publishMode: 'draft',
      learn: tools.learn,
      model: tools.route ? 'auto' : 'claude-sonnet-4-6',
    });
    onClose();
  }

  async function startBlank() {
    setBusy(true);
    try { await hq.createAgent(''); onClose(); } finally { setBusy(false); }
  }

  return (
    <div className="modal__backdrop" onClick={onClose}>
      <div className="modal__card modal__card--wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div>
            <h3 className="admin__title">Create agent</h3>
            <div className="hq-wizsteps">
              {['Describe', 'Tools', 'The loop'].map((s, i) => (
                <span key={s} className={`hq-wizstep ${step === i + 1 ? 'hq-wizstep--on' : ''} ${step > i + 1 ? 'hq-wizstep--done' : ''}`}>
                  {step > i + 1 ? '✓' : i + 1} {s}
                </span>
              ))}
            </div>
          </div>
          <button className="modal__close" onClick={onClose}>×</button>
        </div>

        {/* ---- step 1: describe + enhance ---- */}
        {step === 1 && (
          <>
            <p className="admin__muted">A couple of words is enough — then let the Kensei ⚔️ turn it into a proper agent.</p>
            <textarea className="admin__textarea" rows={2} autoFocus
              placeholder="e.g. watch eTenders for software contracts worth bidding on"
              value={desc} onChange={(e) => setDesc(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && desc.trim() && !busy && (e.preventDefault(), enhance())} />
            {error && <p className="admin__error">{error}</p>}
            <div className="hq-editrow">
              <button className="admin__btn hq-btn--auto" disabled={busy || !desc.trim()} onClick={enhance}>
                {busy ? 'Enhancing…' : '✨ Enhance'}
              </button>
              <button className="hq-quick__btn hq-quick__btn--new" disabled={ideasBusy} onClick={getIdeas}>
                {ideasBusy ? 'Thinking…' : '💡 Ideas'}
              </button>
              <button className="hq-quick__btn" disabled={busy} onClick={startBlank}>skip — start blank</button>
            </div>
            {ideas && (
              <div className="hq-ideawrap">
                <p className="admin__muted" style={{ margin: '0.2rem 0 0.4rem' }}>
                  Based on your team, your business and patterns agent builders share publicly — click one and it fills the box and enhances itself.
                </p>
                <div className="hq-ideagrid">
                  {ideas.map((i, k) => (
                    <button key={k} className="hq-idea" disabled={busy} onClick={() => pickIdea(i)}>
                      <span className={`hq-idea__angle hq-idea__angle--${i.angle || 'new'}`}>
                        {i.angle === 'team' ? 'builds on your team' : i.angle === 'community' ? 'community pattern' : 'new for you'}
                      </span>
                      <strong>{i.title}</strong>
                      <small>{i.pitch}</small>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {draft && (
              <div className="hq-draftcard">
                <div className="hq-draftcard__head">
                  <span className="demoji">{draft.emoji}</span>
                  <strong>{draft.name}</strong>
                  <button className="hq-quick__btn" style={{ marginLeft: 'auto' }} disabled={busy} onClick={enhance}>↻ re-enhance</button>
                </div>
                <label className="admin__label">Role</label>
                <textarea className="admin__textarea admin__textarea--sm" rows={3} value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })} />
                <label className="admin__label">Task</label>
                <textarea className="admin__textarea admin__textarea--sm" rows={4} value={draft.task} onChange={(e) => setDraft({ ...draft, task: e.target.value })} />
                <button className="admin__btn hq-btn--run" style={{ marginTop: '0.8rem' }} onClick={() => setStep(2)}>Next: tools →</button>
              </div>
            )}
          </>
        )}

        {/* ---- step 2: tools ---- */}
        {step === 2 && draft && (
          <>
            <p className="admin__muted">The Kensei pre-selected what {draft.name} needs. Untick anything you don't want it to have.</p>
            <div className="hq-toolgrid">
              {TOOL_DEFS.map((t) => (
                <label key={t.id} className={`hq-tool ${tools[t.id] ? 'hq-tool--on' : ''}`}>
                  <input type="checkbox" checked={tools[t.id]} onChange={(e) => setTools({ ...tools, [t.id]: e.target.checked })} />
                  <span className="hq-tool__icon">{t.icon}</span>
                  <span>
                    <strong>{t.name}</strong>
                    <small>{t.desc}</small>
                  </span>
                </label>
              ))}
            </div>
            {tools.security && (
              <>
                <label className="admin__label">Target repo <span>owner/name — what the 🛡️ scan runs on (changeable later in the editor)</span></label>
                <input className="admin__input" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="fechinmitchell/FMSoftware" />
              </>
            )}
            <div className="hq-editrow">
              <button className="hq-quick__btn" onClick={() => setStep(1)}>← back</button>
              <button className="admin__btn hq-btn--run" onClick={() => setStep(3)}>Next: see the loop →</button>
            </div>
          </>
        )}

        {/* ---- step 3: the loop + accept ---- */}
        {step === 3 && draft && (
          <>
            <p className="admin__muted">This is the loop {draft.name} will run every time. Happy? Put it on the board.</p>
            <LoopGraphic emoji={draft.emoji} tools={tools} />
            <div className="hq-editrow">
              <button className="hq-quick__btn" onClick={() => setStep(2)}>← back</button>
              <button className="admin__btn hq-btn--run" onClick={accept}>✓ Accept — add {draft.emoji} {draft.name} to the board</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* the loop, drawn from the selected tools */
function LoopGraphic({ emoji, tools }) {
  const steps = tools.security
    ? [
      { icon: '🤖', label: 'Kensei', sub: 'starts the scan' },
      { icon: '🛡️', label: 'Scans the repo', sub: 'patterns + AI review' },
      { icon: '📄', label: 'Findings', sub: 'severity + fixes' },
    ]
    : [
      { icon: '🤖', label: 'Kensei', sub: tools.route ? 'picks the model' : 'Sonnet, pinned' },
      { icon: emoji || '🤖', label: 'Agent runs', sub: tools.web ? 'with web search' : 'from its prompt' },
      { icon: '📄', label: 'Output', sub: 'in the drawer' },
    ];
  if (tools.blog) {
    steps.push({ icon: '📥', label: 'You approve', sub: 'one click' });
    steps.push({ icon: '🌐', label: 'Live on /blog', sub: 'auto deploy' });
  }
  if (tools.learn) steps.push({ icon: '🧠', label: 'Lesson saved', sub: 'kaizen.md' });

  const W = 640, H = 190, PAD = 55;
  const n = steps.length;
  const xs = steps.map((_, i) => PAD + (i * (W - PAD * 2)) / (n - 1));
  const Y = 70;
  const loopFrom = xs[n - 1], loopTo = xs[1]; // last step curls back to "Agent runs"
  return (
    <svg className="hq-loopsvg" viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <marker id="hqArr" markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto">
          <path d="M0 0 L7 3.5 L0 7 Z" fill="#54775B" />
        </marker>
      </defs>
      {/* forward arrows */}
      {xs.slice(0, -1).map((x, i) => (
        <line key={i} x1={x + 26} y1={Y} x2={xs[i + 1] - 26} y2={Y} stroke="#54775B" strokeWidth="2.5" strokeDasharray="4 5" markerEnd="url(#hqArr)" opacity=".8" />
      ))}
      {/* the loop back — self improvement */}
      {tools.learn && (
        <>
          <path d={`M ${loopFrom} ${Y + 28} C ${loopFrom} ${H - 22}, ${loopTo} ${H - 22}, ${loopTo} ${Y + 30}`}
            fill="none" stroke="#C97B5A" strokeWidth="2.5" strokeDasharray="4 5" markerEnd="url(#hqArr)" opacity=".9" />
          <text x={(loopFrom + loopTo) / 2} y={H - 26} textAnchor="middle" fontSize="11" fontWeight="700" fill="#C97B5A">✨ next run is v2, then v3 — smarter every time</text>
        </>
      )}
      {/* nodes */}
      {steps.map((s, i) => (
        <g key={i}>
          <circle cx={xs[i]} cy={Y} r="24" fill="#fff" stroke={i === 0 ? '#6B8F71' : i === n - 1 && tools.learn ? '#C97B5A' : 'rgba(30,51,42,.25)'} strokeWidth="2.5" />
          <text x={xs[i]} y={Y + 6} textAnchor="middle" fontSize="17">{s.icon}</text>
          <text x={xs[i]} y={Y + 44} textAnchor="middle" fontSize="11" fontWeight="700" fill="#1E332A">{s.label}</text>
          <text x={xs[i]} y={Y + 58} textAnchor="middle" fontSize="9.5" fill="rgba(30,51,42,.5)">{s.sub}</text>
        </g>
      ))}
    </svg>
  );
}

/* ---------------- edit ---------------- */
function EditExisting({ hq, agent, onClose, onRun, onOpenOutput }) {
  const version = agent.versions.find((v) => v.v === agent.current) || agent.versions[agent.versions.length - 1];
  const [meta, setMeta] = useState({ emoji: agent.emoji, name: agent.name, model: agent.model, webSearch: agent.webSearch, publishMode: agent.publishMode || 'draft', target: agent.target || '' });
  const [role, setRole] = useState(version.role);
  const [task, setTask] = useState(version.task);
  const [tab, setTab] = useState('prompt'); // prompt | kaizen | history
  const [critique, setCritique] = useState('');
  const [improving, setImproving] = useState(false);
  const [error, setError] = useState('');
  const running = hq.busyIds.has(agent.id);

  function save() {
    hq.saveAgentMeta(agent.id, meta, { role, task });
  }
  function saveAndClose() { save(); onClose(); }

  async function improve() {
    save(); setImproving(true); setError('');
    try {
      const created = await hq.newVersion(agent.id, critique);
      setCritique('');
      if (created) { setRole(created.role); setTask(created.task); setTab('prompt'); }
    } catch (e) { setError(e.message); }
    finally { setImproving(false); }
  }

  function pickVersion(v) {
    hq.rollbackTo(agent.id, v);
    const ver = agent.versions.find((x) => x.v === v);
    if (ver) { setRole(ver.role); setTask(ver.task); }
  }

  return (
    <div className="modal__backdrop" onClick={saveAndClose}>
      <div className="modal__card modal__card--wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div className="hq-edithead">
            <input className="hq-emojiin" value={meta.emoji} onChange={(e) => setMeta({ ...meta, emoji: e.target.value })} />
            <input className="hq-namein" value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} />
            <span className="hq-vpills">
              {agent.versions.map((v) => (
                <button key={v.v} className={`hq-vpill ${v.v === agent.current ? 'hq-vpill--on' : ''}`} title={v.note} onClick={() => pickVersion(v.v)}>v{v.v}</button>
              ))}
            </span>
          </div>
          <button className="modal__close" onClick={saveAndClose}>×</button>
        </div>

        <div className="hq-editrow hq-editrow--controls">
          <select className="fnode__model hq-modelsel" value={meta.model} onChange={(e) => setMeta({ ...meta, model: e.target.value })}>
            {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
          <label className="mc__toggle"><input type="checkbox" checked={meta.webSearch} onChange={(e) => setMeta({ ...meta, webSearch: e.target.checked })} /> web search</label>
          {agent.kind === 'security' && (
            <input className="admin__input" style={{ width: 'auto', minWidth: 200, marginTop: 0 }} placeholder="target repo: owner/name"
              value={meta.target} onChange={(e) => setMeta({ ...meta, target: e.target.value })} title="the GitHub repo the 🛡️ scan runs on" />
          )}
          {agent.kind === 'blog' && (
            <label className="mc__toggle" title="draft: posts wait in Approvals. auto: publish straight to the site.">
              publish:
              <select className="fnode__model hq-modelsel" style={{ width: 'auto' }} value={meta.publishMode} onChange={(e) => setMeta({ ...meta, publishMode: e.target.value })}>
                <option value="draft">draft → approval</option>
                <option value="auto">automatic</option>
              </select>
            </label>
          )}
          <span className="hq-edittabs">
            {['prompt', 'kaizen', 'history'].map((t) => (
              <button key={t} className={`hq-themebtn ${tab === t ? 'hq-themebtn--on' : ''}`} onClick={() => { save(); setTab(t); }}>
                {t === 'kaizen' ? `kaizen (${agent.kaizen ? agent.kaizen.split('\n').length : 0})` : t}
              </button>
            ))}
          </span>
        </div>

        {tab === 'prompt' && (
          <>
            <label className="admin__label">Role <span>who this agent is — its system prompt</span></label>
            <textarea className="admin__textarea admin__textarea--sm" rows={4} value={role} onChange={(e) => setRole(e.target.value)} />
            <label className="admin__label">Task <span>what it does every run</span></label>
            <textarea className="admin__textarea" rows={6} value={task} onChange={(e) => setTask(e.target.value)} />
          </>
        )}
        {tab === 'kaizen' && (
          <>
            <label className="admin__label">kaizen.md <span>lessons it has taught itself — injected into every run</span></label>
            <textarea className="admin__textarea" rows={10} value={agent.kaizen}
              onChange={(e) => hq.saveAgentMeta(agent.id, { kaizen: e.target.value })} placeholder="empty — runs and rejection notes fill this in" />
          </>
        )}
        {tab === 'history' && (
          <div className="hq-history">
            {agent.runs.length === 0 && <p className="admin__muted">No runs yet.</p>}
            {[...agent.runs].reverse().map((r) => (
              <button key={r.id} className="hq-runrow" onClick={() => onOpenOutput(agent.id, r.id)}>
                <span className={`runs__dot ${r.error ? 'runs__dot--err' : 'runs__dot--ok'}`} />
                <span>{new Date(r.at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                <span className="hq-runrow__meta">v{r.v} · {modelLabel(r.model)} · ${(r.costUSD || 0).toFixed(2)}{r.reason ? ` · ${r.reason}` : ''}</span>
              </button>
            ))}
          </div>
        )}

        {error && <p className="admin__error">{error}</p>}

        <div className="hq-editrow hq-editrow--footer">
          <button className="admin__btn hq-btn--run" disabled={running} onClick={() => { save(); onRun(agent.id); }}>
            {running ? 'Running…' : `▶ Run v${agent.current}`}
          </button>
          <input className="admin__input hq-critique" placeholder="optional critique to steer the next version…" value={critique} onChange={(e) => setCritique(e.target.value)} />
          <button className="admin__btn hq-btn--new" disabled={improving} onClick={improve}>
            {improving ? 'Improving…' : `✨ New version → v${Math.max(...agent.versions.map((v) => v.v)) + 1}`}
          </button>
          <button className="hq-quick__btn hq-quick__btn--rej" onClick={() => { if (window.confirm(`Delete ${agent.name}?`)) { hq.deleteAgent(agent.id); onClose(); } }}>delete</button>
        </div>
      </div>
    </div>
  );
}