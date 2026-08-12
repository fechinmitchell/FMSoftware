// ------------------------------------------------------------------
//  Outputs page — every saved agent output, analysed into an action
//  plan with tickable steps. Blog-style feed, newest first.
// ------------------------------------------------------------------
import { useState } from 'react';
import useHqStore from './hqStore';
import './hq.css';

function fmtWhen(ts) {
  const d = new Date(ts), nowD = new Date();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === nowD.toDateString()) return 'Today ' + time;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + time;
}

function CopyBtn({ text }) {
  const [done, setDone] = useState(false);
  return (
    <button className="admin__copy" onClick={() => { navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1200); }}>
      {done ? 'Copied' : 'Copy'}
    </button>
  );
}

export default function LibraryPage({ token }) {
  const hq = useHqStore(token);
  const items = hq.state.library || [];

  return (
    <section className="admin__card">
      <div className="admin__toolhead">
        <div>
          <h2 className="admin__title">Outputs</h2>
          <p className="admin__muted">Everything you hit 💾 Save on, analysed into an action plan. Tick steps off as you do them.</p>
        </div>
      </div>

      {items.length === 0 && (
        <p className="admin__muted">Nothing saved yet. Run an agent in Agent HQ, open its Output and hit 💾 Save output — it lands here with actionable steps.</p>
      )}

      {items.map((item) => {
        const total = item.steps ? item.steps.length : 0;
        const done = item.steps ? item.steps.filter((s) => s.done).length : 0;
        return (
          <article key={item.id} className="hq-lib">
            <div className="hq-lib__head">
              <span className="hq-lib__emoji">{item.emoji}</span>
              <div className="hq-lib__titlewrap">
                <h3 className="hq-lib__title">{item.title}</h3>
                <span className="hq-lib__meta">{item.agentName} · {fmtWhen(item.at)}</span>
              </div>
              {total > 0 && (
                <span className={`hq-lib__progress ${done === total ? 'hq-lib__progress--done' : ''}`}>{done}/{total} done</span>
              )}
              <button className="modal__close" title="delete" onClick={() => hq.deleteSaved(item.id)}>×</button>
            </div>

            {item.summary && <p className="hq-lib__summary">{item.summary}</p>}

            {item.steps === null && <p className="hq-lib__analysing">🧠 analysing into action steps…</p>}

            {item.steps && item.steps.length > 0 && (
              <div className="hq-lib__steps">
                {item.steps.map((s, i) => (
                  <label key={i} className={`hq-lib__step ${s.done ? 'hq-lib__step--done' : ''}`}>
                    <input type="checkbox" checked={s.done} onChange={() => hq.toggleStep(item.id, i)} />
                    <span>{s.text}</span>
                  </label>
                ))}
              </div>
            )}

            <details className="hq-lib__orig">
              <summary>original output</summary>
              <div className="hq-lib__outhead"><CopyBtn text={item.output} /></div>
              <pre className="hq-approval__body">{item.output}</pre>
              {item.sources && item.sources.length > 0 && (
                <div className="mc__sources">
                  {item.sources.slice(0, 8).map((src, i) => (
                    <a key={i} className="mc__source" href={src.url} target="_blank" rel="noreferrer">{src.title || src.url}</a>
                  ))}
                </div>
              )}
            </details>
          </article>
        );
      })}
    </section>
  );
}