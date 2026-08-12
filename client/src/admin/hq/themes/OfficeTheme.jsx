// ------------------------------------------------------------------
//  Theme: The Office — pixel floor in the site palette.
//  Contract (identical to DeckTheme):
//    export SLOTS  — hotspot boxes in 960x560 viewBox units
//    export VB     — the viewBox size
//    default Scene({ agents, approvalsCount, recentRuns })
//  The scene only DRAWS. All interactivity lives in shared hotspots
//  that AgentHQ overlays at SLOTS positions.
// ------------------------------------------------------------------

export const VB = { w: 960, h: 560 };

export const SLOTS = {
  agents: [
    { x: 40, y: 70, w: 210, h: 155 },
    { x: 710, y: 70, w: 210, h: 155 },
    { x: 375, y: 55, w: 210, h: 155 },
    { x: 40, y: 370, w: 210, h: 155 },
    { x: 710, y: 370, w: 210, h: 155 },
  ],
  create: { x: 375, y: 395, w: 210, h: 130 },
  approvals: { x: 40, y: 265, w: 200, h: 70 },
};

const WALLS = ['#dbe3e9', '#e7dde9', '#dde9de', '#e9ded7', '#e3e0ea'];
const FLOORS = ['#cdb79a', '#d2c4ac', '#bcc4b4', '#cdb79a', '#d2c4ac'];
const BORDERS = ['#6B8F71', '#E8A87C', '#C97B5A', '#54775B', '#b0506f'];
const SHIRTS = ['#3f6fb0', '#7c5cbf', '#c0563f', '#3f9aa0', '#b08a3f'];
const HAIRS = ['#2b1b0e', '#a8662c', '#4f3318', '#1a1a1a', '#d9b87a'];

function Pod({ slot, agent, i }) {
  const { x, y, w, h } = slot;
  const wall = WALLS[i % WALLS.length], floor = FLOORS[i % FLOORS.length];
  const border = BORDERS[i % BORDERS.length], shirt = SHIRTS[i % SHIRTS.length], hair = HAIRS[i % HAIRS.length];
  const cx = x + w / 2;
  const running = agent.status === 'running';
  const ready = agent.status === 'ready';
  const deskY = y + 62;
  return (
    <g className={running ? 'hqo-pod hqo-pod--busy' : 'hqo-pod'}>
      <rect x={x} y={y} width={w} height={h - 25} rx="8" fill="#e9e3d5" stroke={border} strokeWidth="3" />
      <rect x={x + 3} y={y + 3} width={w - 6} height="24" fill={wall} />
      <rect x={x + 3} y={y + 27} width={w - 6} height="2" fill="rgba(0,0,0,.14)" />
      <rect x={x + 3} y={y + 29} width={w - 6} height={h - 57} fill={floor} />
      {/* desk + monitor */}
      <rect x={cx - 38} y={deskY} width="76" height="24" fill="#9b6b43" />
      <rect x={cx - 38} y={deskY + 20} width="76" height="4" fill="rgba(0,0,0,.18)" />
      <rect x={cx - 11} y={deskY - 9} width="22" height="12" fill="#3a3f4a" />
      <rect x={cx - 9} y={deskY - 7} width="18" height="8" fill="#9fd0d6" className={running ? 'hq-led' : ''} />
      {/* character, facing the desk */}
      <g className={running ? '' : 'hq-bob'}>
        <ellipse cx={cx} cy={deskY + 62} rx="10" ry="3.5" fill="rgba(0,0,0,.16)" />
        <rect x={cx - 7} y={deskY + 53} width="5" height="8" fill="#3b3f4a" />
        <rect x={cx + 2} y={deskY + 53} width="5" height="8" fill="#3b3f4a" />
        <rect x={cx - 9} y={deskY + 38} width="18" height="16" fill={shirt} />
        <rect x={cx - 7} y={deskY + 23} width="14" height="15" fill={hair} />
      </g>
      {/* bubble: dots while running, papers when ready */}
      {running && (
        <g>
          <rect x={cx + 18} y={deskY + 18} width="34" height="18" rx="3" fill="#fff" stroke="rgba(0,0,0,.12)" />
          <rect x={cx + 24} y={deskY + 25} width="4" height="4" fill="#6B8F71" className="hq-d1" />
          <rect x={cx + 31} y={deskY + 25} width="4" height="4" fill="#6B8F71" className="hq-d2" />
          <rect x={cx + 38} y={deskY + 25} width="4" height="4" fill="#6B8F71" className="hq-d3" />
        </g>
      )}
      {ready && (
        <g className="hq-bob">
          <rect x={cx + 26} y={deskY + 34} width="20" height="14" fill="#E8A87C" />
          <rect x={cx + 26} y={deskY + 34} width="20" height="3" fill="rgba(0,0,0,.15)" />
          <rect x={cx + 32} y={deskY + 24} width="20" height="14" fill="#E8A87C" />
          <rect x={cx + 32} y={deskY + 24} width="20" height="3" fill="rgba(0,0,0,.15)" />
        </g>
      )}
      {/* head label */}
      <text x={x + 16} y={y + 20} fontSize="12">{agent.emoji}</text>
      <text x={x + 34} y={y + 20} fontSize="11" fontWeight="700" fill="#1E332A">{agent.name}</text>
      {/* nameplate */}
      <rect x={cx - 76} y={y + h - 22} width="152" height="22" rx="11" fill="#fff" stroke="rgba(30,51,42,.12)" />
      <circle cx={cx - 62} cy={y + h - 11} r="4"
        fill={running ? '#6B8F71' : ready ? '#E8A87C' : 'rgba(30,51,42,.25)'}
        className={running ? 'hq-led' : ''} />
      <text x={cx - 53} y={y + h - 7} fontSize="10" fontWeight="700" fill="#1E332A">
        {running ? 'running' : ready ? 'output ready' : 'idle'} · v{agent.version} · {agent.model}
      </text>
    </g>
  );
}

export default function OfficeScene({ agents, approvalsCount, recentRuns }) {
  const shown = agents.slice(0, SLOTS.agents.length);
  const ap = SLOTS.approvals, cr = SLOTS.create;
  return (
    <svg className="hq-scene__svg" viewBox={`0 0 ${VB.w} ${VB.h}`} xmlns="http://www.w3.org/2000/svg">
      {/* wall + floor */}
      <rect width={VB.w} height="44" fill="#c9bfa6" />
      <rect y="42" width={VB.w} height="3" fill="rgba(0,0,0,.18)" />
      <rect y="44" width={VB.w} height={VB.h - 44} fill="#d8c7a8" />
      {[120, 240, 360, 480, 600, 720, 840].map((x) => (
        <rect key={x} x={x} y="44" width="1" height={VB.h - 44} fill="rgba(0,0,0,.05)" />
      ))}
      {/* hanging sign */}
      <rect x="400" y="2" width="160" height="34" fill="#9b6b43" />
      <rect x="404" y="6" width="152" height="26" fill="#FAF6F0" />
      <text x="480" y="24" textAnchor="middle" fontSize="14" fontWeight="700" fill="#1E332A" style={{ fontFamily: "'Fraunces',serif" }}>FM · Software HQ</text>
      {/* wall shelf */}
      <g>
        <rect x="70" y="8" width="84" height="28" fill="#7d5435" />
        <rect x="70" y="18" width="84" height="1" fill="rgba(0,0,0,.2)" />
        <rect x="70" y="28" width="84" height="1" fill="rgba(0,0,0,.2)" />
        {['#c0563f', '#4f7a52', '#3f6fb0', '#b08a3f', '#7c5cbf', '#b0506f'].map((c, i) => (
          <rect key={i} x={75 + i * 8} y="10" width="5" height="7" fill={c} />
        ))}
        {['#3f9aa0', '#c0563f', '#4f7a52', '#7c5cbf', '#b08a3f'].map((c, i) => (
          <rect key={i} x={76 + i * 9} y="20" width="5" height="7" fill={c} />
        ))}
      </g>
      {/* window */}
      <g>
        <rect x="810" y="6" width="70" height="32" fill="#9fb6c9" />
        <rect x="810" y="6" width="70" height="32" fill="none" stroke="#cfd6dd" strokeWidth="2" />
        <rect x="844" y="6" width="2" height="32" fill="#cfd6dd" />
        <rect x="810" y="21" width="70" height="2" fill="#cfd6dd" />
      </g>

      {/* dotted paths from the plaza — one per BUILT agent only */}
      <g stroke="#54775B" strokeWidth="3" strokeDasharray="2 8" strokeLinecap="round" opacity=".45" fill="none">
        {shown.map((a, i) => {
          const s = SLOTS.agents[i];
          return <path key={a.id} d={`M480 290 L ${s.x + s.w / 2} ${s.y + s.h / 2}`} />;
        })}
      </g>

      {/* centre plaza — the handshake */}
      <g>
        <rect x="385" y="230" width="190" height="120" fill="#b9543f" />
        <rect x="385" y="230" width="190" height="3" fill="rgba(255,255,255,.2)" />
        <g className="hq-bob">
          <rect x="452" y="222" width="46" height="24" rx="4" fill="#fff" stroke="rgba(0,0,0,.15)" />
          <path d="M463 234 l5 5 l9 -9" stroke="#4f7a52" strokeWidth="4" fill="none" />
        </g>
        {/* the Kensei (left) */}
        <rect x="432" y="298" width="5" height="9" fill="#3b3f4a" /><rect x="441" y="298" width="5" height="9" fill="#3b3f4a" />
        <rect x="430" y="281" width="18" height="18" fill="#54775B" />
        <rect x="447" y="288" width="17" height="5" fill="#54775B" /><rect x="461" y="288" width="6" height="5" fill="#e6b08c" />
        <rect x="432" y="264" width="15" height="15" fill="#e6b08c" /><rect x="431" y="261" width="17" height="6" fill="#2b1b0e" />
        {/* Fechín (right) */}
        <rect x="512" y="298" width="5" height="9" fill="#3b3f4a" /><rect x="521" y="298" width="5" height="9" fill="#3b3f4a" />
        <rect x="510" y="281" width="18" height="18" fill="#6B8F71" />
        <rect x="494" y="288" width="17" height="5" fill="#6B8F71" /><rect x="491" y="288" width="6" height="5" fill="#f3cda6" />
        <rect x="511" y="264" width="15" height="15" fill="#f3cda6" /><rect x="510" y="261" width="17" height="6" fill="#4f3318" />
        <text x="440" y="256" textAnchor="middle" fontSize="13">🤖</text>
        <text x="519" y="256" textAnchor="middle" fontSize="13">🧑‍💻</text>
        <text x="480" y="336" textAnchor="middle" fontSize="10" fontWeight="700" fill="rgba(30,20,15,.9)">Kensei · Fechín</text>
      </g>

      {/* agent pods */}
      {shown.map((a, i) => <Pod key={a.id} agent={a} i={i} slot={SLOTS.agents[i]} />)}

      {/* create pod */}
      <g>
        <rect x={cr.x} y={cr.y} width={cr.w} height={cr.h} rx="8" fill="rgba(255,255,255,.45)" stroke="#6B8F71" strokeWidth="3" strokeDasharray="10 7" />
        <circle cx={cr.x + 52} cy={cr.y + cr.h / 2} r="17" fill="#6B8F71" />
        <rect x={cr.x + 50} y={cr.y + cr.h / 2 - 10} width="4" height="20" fill="#fff" />
        <rect x={cr.x + 42} y={cr.y + cr.h / 2 - 2} width="20" height="4" fill="#fff" />
        <text x={cr.x + 80} y={cr.y + cr.h / 2 - 2} fontSize="12" fontWeight="700" fill="#1E332A">Create agent</text>
        <text x={cr.x + 80} y={cr.y + cr.h / 2 + 14} fontSize="10" fill="rgba(30,51,42,.55)">describe it → AI builds it</text>
      </g>

      {/* approvals desk */}
      <g>
        <rect x={ap.x} y={ap.y} width={ap.w} height={ap.h} rx="8" fill="#fff" stroke="rgba(30,51,42,.15)" />
        <text x={ap.x + 16} y={ap.y + 27} fontSize="12" fontWeight="700" fill="#1E332A">📥 Approvals</text>
        <rect x={ap.x + 16} y={ap.y + 37} width="86" height="18" rx="9" fill={approvalsCount ? '#C97B5A' : 'rgba(30,51,42,.12)'} />
        <text x={ap.x + 59} y={ap.y + 50} textAnchor="middle" fontSize="10" fontWeight="700" fill={approvalsCount ? '#fff' : 'rgba(30,51,42,.55)'}>
          {approvalsCount ? `${approvalsCount} waiting` : 'all clear'}
        </text>
      </g>

      {/* run ledger, bottom middle-right when there is history */}
      {recentRuns.length > 0 && (
        <g>
          <rect x="620" y="262" width="300" height="76" rx="9" fill="#1E332A" opacity=".92" />
          <text x="636" y="282" fontSize="9" fontWeight="700" fill="#E8A87C" letterSpacing="2" style={{ fontFamily: 'ui-monospace,Menlo,monospace' }}>RUN LEDGER</text>
          {recentRuns.slice(0, 3).map((r, i) => (
            <text key={r.id} x="636" y={298 + i * 14} fontSize="9.5" fill={r.error ? 'rgba(250,170,140,.9)' : 'rgba(250,246,240,.85)'} style={{ fontFamily: 'ui-monospace,Menlo,monospace' }}>
              {new Date(r.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}  {r.agentName.slice(0, 14).padEnd(14)} {r.error ? 'ERROR' : `ok · ${r.model ? r.model.split('-')[1] : ''} · $${(r.costUSD || 0).toFixed(2)}`}
            </text>
          ))}
        </g>
      )}
    </svg>
  );
}