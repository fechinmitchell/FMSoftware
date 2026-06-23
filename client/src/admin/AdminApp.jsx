import { useState, useEffect } from 'react';
import './AdminApp.css';
import WorkflowBuilder from './WorkflowBuilder';

const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const TOKEN_KEY = 'fm_admin_token';
const BG_KEY = 'fm_admin_background';
const COUNT_KEY = 'fm_admin_daily';

const DEFAULT_BACKGROUND =
  `I run FM Software, a one person studio in Galway Ireland. I build production web software for professional services firms, including a client portal for a US law firm, a psychotherapy practice site and Scorelect a GAA scoring platform. I have an MSc in Software Engineering. I build with React and Node and I do AI automation and integrations. I work as a contractor, I can start quickly and I ship in weeks not months.`;

/* ------------------------------------------------------------------ */
/*  Root                                                              */
/* ------------------------------------------------------------------ */
export default function AdminApp() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!token) { setChecking(false); return; }
    fetch(`${API}/api/admin/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => { if (!r.ok) throw new Error(); })
      .catch(() => { localStorage.removeItem(TOKEN_KEY); setToken(''); })
      .finally(() => setChecking(false));
  }, [token]);

  function signIn(t) {
    localStorage.setItem(TOKEN_KEY, t);
    setToken(t);
  }
  function signOut() {
    localStorage.removeItem(TOKEN_KEY);
    setToken('');
  }

  if (checking) {
    return <div className="admin admin--center"><p className="admin__muted">Loading…</p></div>;
  }
  return token
    ? <Dashboard token={token} onSignOut={signOut} />
    : <Login onSignIn={signIn} />;
}

/* ------------------------------------------------------------------ */
/*  Login                                                             */
/* ------------------------------------------------------------------ */
function Login({ onSignIn }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(''); setBusy(true);
    try {
      const r = await fetch(`${API}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error || 'Could not sign in.'); return; }
      onSignIn(data.token);
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin admin--center">
      <div className="admin__card admin__login">
        <div className="admin__brand">FM<span>·</span>Software</div>
        <h1 className="admin__title">Studio tools</h1>
        <p className="admin__muted">Private. Sign in to continue.</p>
        <input
          className="admin__input"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          autoFocus
        />
        {error && <p className="admin__error">{error}</p>}
        <button className="admin__btn" onClick={submit} disabled={busy || !password}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Dashboard                                                         */
/* ------------------------------------------------------------------ */
const TOOLS = [
  { id: 'outreach', label: 'Outreach drafter' },
  { id: 'workflow', label: 'Workflow builder' },
];

function Dashboard({ token, onSignOut }) {
  const [tool, setTool] = useState('outreach');
  return (
    <div className="admin">
      <header className="admin__bar">
        <div className="admin__brand">FM<span>·</span>Software</div>
        <nav className="admin__tabs">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              className={`admin__tab ${tool === t.id ? 'admin__tab--on' : ''}`}
              onClick={() => setTool(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <button className="admin__link" onClick={onSignOut}>Sign out</button>
      </header>
      <main className="admin__main">
        {tool === 'outreach' && <OutreachDrafter token={token} />}
        {tool === 'workflow' && <WorkflowBuilder token={token} />}
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tool: Outreach drafter                                            */
/* ------------------------------------------------------------------ */
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}
function readCount() {
  try {
    const raw = JSON.parse(localStorage.getItem(COUNT_KEY) || '{}');
    return raw.date === todayKey() ? (raw.count || 0) : 0;
  } catch { return 0; }
}
function bumpCount() {
  const next = readCount() + 1;
  localStorage.setItem(COUNT_KEY, JSON.stringify({ date: todayKey(), count: next }));
  return next;
}

function OutreachDrafter({ token }) {
  const [background, setBackground] = useState(() => localStorage.getItem(BG_KEY) || DEFAULT_BACKGROUND);
  const [jobText, setJobText] = useState('');
  const [contactName, setContactName] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [count, setCount] = useState(readCount());

  useEffect(() => { localStorage.setItem(BG_KEY, background); }, [background]);

  async function draft() {
    setError(''); setResult(null); setBusy(true);
    try {
      const r = await fetch(`${API}/api/admin/draft`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ background, jobText, contactName }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error || 'Could not draft.'); return; }
      setResult(data);
      setCount(bumpCount());
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin__card">
      <div className="admin__toolhead">
        <div>
          <h2 className="admin__title">Outreach drafter</h2>
          <p className="admin__muted">Paste a posting. Get an email, a LinkedIn version and a few build ideas.</p>
        </div>
        <span className="admin__pill" title="Drafts sent today">{count} / 5 today</span>
      </div>

      <label className="admin__label">Your background <span>editable, saved on this device</span></label>
      <textarea
        className="admin__textarea admin__textarea--sm"
        value={background}
        onChange={(e) => setBackground(e.target.value)}
        rows={4}
      />

      <label className="admin__label">Job posting</label>
      <textarea
        className="admin__textarea"
        placeholder="Paste the job description or the bits that matter…"
        value={jobText}
        onChange={(e) => setJobText(e.target.value)}
        rows={8}
      />

      <label className="admin__label">Contact name <span>optional</span></label>
      <input
        className="admin__input"
        placeholder="e.g. Sarah, head of ops"
        value={contactName}
        onChange={(e) => setContactName(e.target.value)}
      />

      {error && <p className="admin__error">{error}</p>}

      <button className="admin__btn" onClick={draft} disabled={busy || !jobText.trim()}>
        {busy ? 'Drafting…' : 'Draft outreach'}
      </button>

      {result && (
        <div className="admin__results">
          {result.subject && <Field label="Subject" value={result.subject} />}
          {result.email && <Field label="Email" value={result.email} big />}
          {result.linkedin && <Field label="LinkedIn message" value={result.linkedin} />}
          {Array.isArray(result.ideas) && result.ideas.length > 0 && (
            <div className="admin__field">
              <div className="admin__fieldhead">
                <span className="admin__label">Build ideas</span>
                <CopyBtn text={result.ideas.map((i) => `• ${i}`).join('\n')} />
              </div>
              <ul className="admin__ideas">
                {result.ideas.map((idea, i) => <li key={i}>{idea}</li>)}
              </ul>
            </div>
          )}
          {result.followup && <Field label="Follow up" value={result.followup} />}
        </div>
      )}
    </section>
  );
}

function Field({ label, value, big }) {
  return (
    <div className="admin__field">
      <div className="admin__fieldhead">
        <span className="admin__label">{label}</span>
        <CopyBtn text={value} />
      </div>
      <div className={`admin__output${big ? ' admin__output--big' : ''}`}>{value}</div>
    </div>
  );
}

function CopyBtn({ text }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="admin__copy"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1400);
      }}
    >
      {done ? 'Copied' : 'Copy'}
    </button>
  );
}