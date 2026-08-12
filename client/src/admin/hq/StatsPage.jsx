// ------------------------------------------------------------------
//  Stats page — visits, countries, referrers, bots vs humans.
//  Data comes from the /api/stats beacon on the site + blog pages.
// ------------------------------------------------------------------
import { useState, useEffect, useCallback } from 'react';
import './hq.css';

const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

const fmtWhen = (ts) => {
  const d = new Date(ts), nowD = new Date();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toDateString() === nowD.toDateString() ? time
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + time;
};

function TopTable({ title, data, keyLabel }) {
  const rows = Object.entries(data || {}).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const max = rows.length ? rows[0][1] : 1;
  return (
    <div className="hq-stattablewrap">
      <p className="admin__label" style={{ marginTop: 0 }}>{title}</p>
      {rows.length === 0 && <p className="admin__muted" style={{ fontSize: '.86rem' }}>nothing yet</p>}
      {rows.map(([k, v]) => (
        <div key={k} className="hq-costagent">
          <span className="hq-statkey" title={k}>{k || '(direct)'}</span>
          <span className="hq-costagent__bar"><i style={{ width: `${Math.max(4, (v / max) * 100)}%` }} /></span>
          <strong>{v}</strong>
        </div>
      ))}
    </div>
  );
}

export default function StatsPage({ token }) {
  const [s, setS] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true); setError('');
    try {
      const r = await fetch(`${API}/api/stats/summary`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Could not load stats.');
      setS(data);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const byDay = (s && s.byDay) || {};
  const todayKey = new Date().toISOString().slice(0, 10);
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - i);
    return byDay[d.toISOString().slice(0, 10)] || 0;
  }).reduce((a, b) => a + b, 0);
  const humans = s ? (s.humans ?? s.total - s.bots) : 0;
  const botPct = s && s.total ? Math.round((s.bots / s.total) * 100) : 0;

  const cells = s ? [
    ['Today', byDay[todayKey] || 0], ['Last 7 days', last7], ['Humans all time', humans],
    ['Bots all time', s.bots], ['Bot share', `${botPct}%`],
  ] : [];

  return (
    <section className="admin__card">
      <div className="admin__toolhead">
        <div>
          <h2 className="admin__title">Stats</h2>
          <p className="admin__muted">Who's visiting fmsoftware.ie and the blog — humans, where they came from, and which bots are crawling you.</p>
        </div>
        <button className="hq-quick__btn" disabled={busy} onClick={load}>{busy ? 'Loading…' : '↻ Refresh'}</button>
      </div>

      {error && <p className="admin__error">{error}</p>}

      {s && (
        <>
          <div className="hq-costgrid">
            {cells.map(([label, v]) => (
              <div key={label} className={`hq-costcell ${label === 'Bots all time' || label === 'Bot share' ? 'hq-costcell--all' : ''}`}>
                <span className="hq-costcell__num">{v}</span>
                <span className="hq-costcell__label">{label}</span>
              </div>
            ))}
          </div>

          <div className="hq-statgrid">
            <TopTable title="Top pages (human views)" data={s.byPath} />
            <TopTable title="Countries" data={s.byCountry} />
            <TopTable title="Referrers" data={s.byRef} />
          </div>

          <p className="admin__label">Recent visits</p>
          <div className="hq-recent">
            {(s.recent || []).length === 0 && <p className="admin__muted">No visits recorded yet — open the live site once and refresh.</p>}
            {(s.recent || []).slice(0, 40).map((h, i) => (
              <div key={i} className="hq-recentrow">
                <span className="hq-recentwhen">{fmtWhen(h.at)}</span>
                <span className="hq-recentpath" title={h.path}>{h.path}</span>
                {h.bot
                  ? <span className="hq-botbadge" title={h.ua || 'bot'}>🤖 bot</span>
                  : <span className="hq-recentgeo">{h.country}</span>}
                {h.ref && <span className="hq-recentref">← {h.ref}</span>}
              </div>
            ))}
          </div>

          <p className="admin__muted" style={{ marginTop: '1rem', fontSize: '.82rem' }}>
            Counts live on the Render server and reset when it redeploys. For permanent history, also flip on Web Analytics in the Vercel dashboard — the two together give you live detail plus long-term trends.
          </p>
        </>
      )}
    </section>
  );
}