// ------------------------------------------------------------------
//  Theme: The Command Deck — futuristic, in the site's light palette.
//  Cream background, sage holo-lines, white pods with coloured rings.
//  Contract (identical to OfficeTheme):
//    export SLOTS  — hotspot boxes in 960x560 viewBox units
//    export VB     — the viewBox size
//    default Scene({ agents, approvalsCount, recentRuns })
// ------------------------------------------------------------------

export const VB = { w: 960, h: 560 };

export const SLOTS = {
  agents: [
    { x: 250, y: 80, w: 130, h: 130 },
    { x: 590, y: 90, w: 130, h: 130 },
    { x: 185, y: 290, w: 130, h: 130 },
    { x: 640, y: 290, w: 130, h: 130 },
    { x: 415, y: 30, w: 130, h: 110 },
  ],
  create: { x: 585, y: 430, w: 170, h: 90 },
  approvals: { x: 784, y: 460, w: 150, h: 60 },
};

const INK = '#1E332A';
const INK50 = 'rgba(30,51,42,.5)';
const MONO = 'ui-monospace,Menlo,monospace';
const RINGS = ['#6B8F71', '#E8A87C', '#C97B5A', '#54775B', '#b0506f'];

function Satellite({ slot, agent, i }) {
  const cx = slot.x + slot.w / 2, cy = slot.y + slot.h / 2 - 8;
  const ring = RINGS[i % RINGS.length];
  const running = agent.status === 'running';
  const ready = agent.status === 'ready';
  const R = 30;
  const hex = `${cx},${cy - R} ${cx + R * 0.87},${cy - R / 2} ${cx + R * 0.87},${cy + R / 2} ${cx},${cy + R} ${cx - R * 0.87},${cy + R / 2} ${cx - R * 0.87},${cy - R / 2}`;
  return (
    <g>
      <g className="hq-bob" style={{ animationDelay: `${i * 0.6}s` }}>
        <polygon points={hex} fill="#FFFFFF" stroke={ring} strokeWidth="3" style={{ filter: `drop-shadow(0 3px 8px ${ring}66)` }} />
        {/* solar panels */}
        <rect x={cx - R - 14} y={cy - 7} width="12" height="14" rx="2" fill={ring} opacity=".8" />
        <rect x={cx + R + 2} y={cy - 7} width="12" height="14" rx="2" fill={ring} opacity=".8" />
        <text x={cx} y={cy + 6} textAnchor="middle" fontSize="16">{agent.emoji}</text>
        {running && <polygon points={`${cx - 14},${cy + R} ${cx + 14},${cy + R} ${cx + 26},${cy + R + 42} ${cx - 26},${cy + R + 42}`} fill="url(#hqCone)" className="hq-led" />}
        {ready && (
          <g className="hq-led" style={{ animationDuration: '2.2s' }}>
            <rect x={cx + R - 4} y={cy - R - 6} width="15" height="11" rx="2" fill="#E8A87C" stroke="#c9895b" />
            <rect x={cx + R + 13} y={cy - R + 1} width="15" height="11" rx="2" fill="#E8A87C" stroke="#c9895b" />
          </g>
        )}
      </g>
      <rect x={cx - 82} y={slot.y + slot.h - 20} width="164" height="20" rx="10" fill="#FFFFFF" stroke="rgba(30,51,42,.14)" />
      <circle cx={cx - 68} cy={slot.y + slot.h - 10} r="3.5" fill={running ? '#6B8F71' : ready ? '#E8A87C' : 'rgba(30,51,42,.22)'} className={running ? 'hq-led' : ''} />
      <text x={cx - 59} y={slot.y + slot.h - 6} fontSize="9" fontWeight="700" fill={INK} style={{ fontFamily: MONO }}>
        {agent.name.toUpperCase().slice(0, 13)} · {running ? 'SWEEP' : ready ? `${agent.kind === 'blog' ? 'PAYLOAD' : 'DATA'} ✓` : 'IDLE'} · v{agent.version} · {agent.model.toUpperCase()}
      </text>
    </g>
  );
}

export default function DeckScene({ agents, approvalsCount, recentRuns }) {
  const shown = agents.slice(0, SLOTS.agents.length);
  const cr = SLOTS.create, ap = SLOTS.approvals;
  return (
    <svg className="hq-scene__svg" viewBox={`0 0 ${VB.w} ${VB.h}`} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="hqDeck" cx="50%" cy="45%" r="80%">
          <stop offset="0%" stopColor="#FDFBF7" /><stop offset="100%" stopColor="#F0E9DC" />
        </radialGradient>
        <linearGradient id="hqCone" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(107,143,113,.45)" /><stop offset="100%" stopColor="rgba(107,143,113,0)" />
        </linearGradient>
      </defs>
      <rect width={VB.w} height={VB.h} fill="url(#hqDeck)" rx="12" />

      {/* soft holo dots + blueprint grid */}
      <g fill="rgba(107,143,113,.35)">
        {[[70, 60, 1.4], [180, 130, 1], [130, 330, 1.2], [300, 60, 1], [420, 505, 1.3], [640, 55, 1], [760, 120, 1.4], [890, 70, 1], [850, 260, 1.2], [900, 400, 1], [240, 470, 1.2], [60, 440, 1], [560, 470, 1.1], [340, 250, 1], [700, 260, 1]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} />)}
      </g>
      <g stroke="rgba(30,51,42,.06)" strokeWidth="1">
        {[100, 200, 300, 400, 500].map((y) => <path key={y} d={`M0 ${y} H${VB.w}`} />)}
        {[120, 280, 440, 600, 760, 920].map((x) => <path key={x} d={`M${x} 0 V${VB.h}`} />)}
      </g>

      <text x="36" y="42" fontSize="15" fontWeight="700" fill={INK} style={{ fontFamily: "'Fraunces',serif" }}>FM · Software — command deck</text>
      <text x="36" y="60" fontSize="10" fill={INK50} style={{ fontFamily: MONO }}>kensei online · auto model assignment ACTIVE</text>

      {/* orbit rings */}
      <g fill="none" stroke="rgba(107,143,113,.3)" strokeWidth="1.5">
        <circle cx="480" cy="255" r="110" strokeDasharray="3 7" />
        <circle cx="480" cy="255" r="175" strokeDasharray="3 7" />
      </g>

      {/* links — one per BUILT agent only */}
      <g strokeWidth="1.5" fill="none">
        {shown.map((a, i) => {
          const s = SLOTS.agents[i];
          return <path key={a.id} d={`M480 255 L ${s.x + s.w / 2} ${s.y + s.h / 2}`} stroke={`${RINGS[i % RINGS.length]}77`} className={a.status === 'running' ? 'hq-flow' : ''} />;
        })}
      </g>

      {/* the Kensei */}
      <g>
        <circle cx="480" cy="255" r="52" fill="none" stroke="rgba(107,143,113,.45)" strokeWidth="1.5" className="hq-ping" />
        <g className="hq-spin">
          <path d="M480 255 L480 195 A60 60 0 0 1 532 225 Z" fill="rgba(107,143,113,.16)" />
        </g>
        <circle cx="480" cy="255" r="34" fill="#FFFFFF" stroke="#6B8F71" strokeWidth="3" style={{ filter: 'drop-shadow(0 3px 10px rgba(107,143,113,.5))' }} />
        <circle cx="480" cy="255" r="42" fill="none" stroke="rgba(107,143,113,.45)" strokeWidth="1" />
        <text x="480" y="263" textAnchor="middle" fontSize="20">🤖</text>
        <text x="480" y="316" textAnchor="middle" fontSize="11" fontWeight="700" fill={INK}>KENSEI</text>
        <text x="480" y="330" textAnchor="middle" fontSize="9" fill={INK50} style={{ fontFamily: MONO }}>routes agents · assigns models</text>
      </g>

      {/* downlink beam + ground station (the handshake) */}
      <path d="M480 297 V 448" stroke="#6B8F71" strokeWidth="2.5" className="hq-flow" opacity=".8" />
      <g className="hq-bob">
        <rect x="448" y="356" width="64" height="20" rx="10" fill="#FFFFFF" stroke="#6B8F71" strokeWidth="1.5" />
        <text x="480" y="370" textAnchor="middle" fontSize="9.5" fontWeight="700" fill={INK}>LINK ✓ DEAL</text>
      </g>
      <g>
        <circle cx="480" cy="475" r="26" fill="#FFFFFF" stroke="#E8A87C" strokeWidth="3" style={{ filter: 'drop-shadow(0 3px 10px rgba(232,168,124,.55))' }} />
        <text x="480" y="483" textAnchor="middle" fontSize="16">🧑‍💻</text>
        <text x="480" y="519" textAnchor="middle" fontSize="11" fontWeight="700" fill={INK}>GROUND STATION · FECHÍN</text>
        <text x="480" y="533" textAnchor="middle" fontSize="9" fill={INK50} style={{ fontFamily: MONO }}>fmsoftware.ie</text>
      </g>

      {/* satellites */}
      {shown.map((a, i) => <Satellite key={a.id} agent={a} i={i} slot={SLOTS.agents[i]} />)}

      {/* deploy slot */}
      <g>
        <circle cx={cr.x + 40} cy={cr.y + 40} r="24" fill="rgba(255,255,255,.6)" stroke="#6B8F71" strokeWidth="2" strokeDasharray="6 6" />
        <rect x={cr.x + 37} y={cr.y + 26} width="6" height="28" fill="#6B8F71" />
        <rect x={cr.x + 26} y={cr.y + 37} width="28" height="6" fill="#6B8F71" />
        <text x={cr.x + 78} y={cr.y + 37} fontSize="9.5" fontWeight="700" fill={INK} style={{ fontFamily: MONO }}>DEPLOY NEW</text>
        <text x={cr.x + 78} y={cr.y + 50} fontSize="9.5" fontWeight="700" fill={INK} style={{ fontFamily: MONO }}>AGENT</text>
      </g>

      {/* uplink queue = approvals */}
      <g>
        <rect x={ap.x} y={ap.y} width={ap.w} height={ap.h} rx="10" fill="#FFFFFF" stroke={approvalsCount ? '#C97B5A' : 'rgba(30,51,42,.14)'} strokeWidth="2" style={{ filter: approvalsCount ? 'drop-shadow(0 3px 10px rgba(201,123,90,.45))' : 'none' }} />
        <text x={ap.x + 14} y={ap.y + 22} fontSize="10.5" fontWeight="700" fill={INK}>📥 UPLINK QUEUE</text>
        <rect x={ap.x + 14} y={ap.y + 30} width="104" height="16" rx="8" fill={approvalsCount ? '#C97B5A' : 'rgba(30,51,42,.08)'} />
        <text x={ap.x + 66} y={ap.y + 42} textAnchor="middle" fontSize="8.5" fontWeight="700" fill={approvalsCount ? '#fff' : INK50}>
          {approvalsCount ? `${approvalsCount} AWAITING APPROVAL` : 'ALL CLEAR'}
        </text>
      </g>

      {/* telemetry console */}
      <g>
        <rect x="26" y="438" width="330" height={recentRuns.length ? 26 + Math.min(recentRuns.length, 4) * 17 + 10 : 56} rx="10" fill="#FFFFFF" stroke="rgba(30,51,42,.12)" />
        <text x="42" y="458" fontSize="9.5" fontWeight="700" fill="#C97B5A" letterSpacing="2" style={{ fontFamily: MONO }}>TELEMETRY</text>
        {recentRuns.length === 0 && (
          <text x="42" y="478" fontSize="10" fill={INK50} style={{ fontFamily: MONO }}>no runs yet ▸ launch an agent</text>
        )}
        {recentRuns.slice(0, 4).map((r, i) => (
          <text key={r.id} x="42" y={478 + i * 17} fontSize="10" fill={r.error ? '#B5503F' : i === 0 ? 'rgba(30,51,42,.85)' : 'rgba(30,51,42,.45)'} style={{ fontFamily: MONO }}>
            {new Date(r.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} {r.agentName.toUpperCase().replace(/ /g, '-').slice(0, 13).padEnd(14)}▸ {r.error ? 'error' : `ok · ${r.model ? r.model.split('-')[1] : ''} · $${(r.costUSD || 0).toFixed(2)}`}
          </text>
        ))}
      </g>
    </svg>
  );
}