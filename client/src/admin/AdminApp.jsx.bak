import { useState, useEffect } from 'react';
import './AdminApp.css';
import MissionControl from './MissionControl';
import FlowBuilder from './FlowBuilder';
import RunsPage from './RunsPage';

const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const TOKEN_KEY = 'fm_admin_token';

/* ------------------------------------------------------------------ */
/*  Root                                                              */
/* ------------------------------------------------------------------ */
export default function AdminApp() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!token) { setChecking(false); return; }
    fetch(`${API}/api/admin/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => { if (!r.ok) throw new Error(); })
      .catch(() => { localStorage.removeItem(TOKEN_KEY); setToken(''); })
      .finally(() => setChecking(false));
  }, [token]);

  function signIn(t) { localStorage.setItem(TOKEN_KEY, t); setToken(t); }
  function signOut() { localStorage.removeItem(TOKEN_KEY); setToken(''); }

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
  { id: 'command', label: 'Command Center' },
  { id: 'flow', label: 'Agent Flow' },
  { id: 'runs', label: 'Run Agent' },
];

function Dashboard({ token, onSignOut }) {
  const [tool, setTool] = useState('command');
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
      <main className={`admin__main ${(tool === 'flow' || tool === 'command') ? 'admin__main--wide' : ''}`}>
        {tool === 'command' && <MissionControl token={token} />}
        {tool === 'runs' && <RunsPage token={token} />}
        {tool === 'flow' && (
          <section className="admin__card">
            <div className="admin__toolhead">
              <div>
                <h2 className="admin__title">Agent Flow</h2>
                <p className="admin__muted">Build a precise agent by hand. Drag nodes out, wire them up, run the chain. The wiring sets the order.</p>
              </div>
            </div>
            <FlowBuilder token={token} />
          </section>
        )}
      </main>
    </div>
  );
}