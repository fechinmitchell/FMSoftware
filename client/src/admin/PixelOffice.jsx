import './PixelOffice.css';

/* tiny deterministic PRNG so each office is unique but stable */
function xfnv1a(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const chance = (rng, p) => rng() < p;

const SKINS = ['#f3cda6', '#e6b08c', '#cf9b6f', '#b07a4e', '#8d5a34', '#ffd9b8'];
const HAIRS = ['#2b1b0e', '#4f3318', '#7a4a1e', '#a8662c', '#d9b87a', '#1a1a1a', '#9a9a9a', '#5b3a8c'];
const SHIRTS = ['#c0563f', '#4f7a52', '#3f6fb0', '#b08a3f', '#7c5cbf', '#3f9aa0', '#b0506f', '#5a6b8c', '#c97b5a', '#6b8f71'];
const WALLS = ['#e9e3d5', '#dbe3e9', '#e7dde9', '#dde9de', '#e9ded7', '#e3e0ea'];
const FLOORS = ['#caa57f', '#bb9d87', '#aab2a2', '#c2b49c', '#b9a98f'];
const RUGS = ['#b9543f', '#4f7a76', '#7c5cbf', '#3f6fb0', '#c08a3f'];
const WOODS = [['#9b6b43', '#7d5435'], ['#8a5a3a', '#6e472d'], ['#a87a4e', '#855d39']];
const BOOKS = ['#c0563f', '#4f7a52', '#3f6fb0', '#b08a3f', '#7c5cbf', '#b0506f', '#3f9aa0'];

function kitFor(text) {
  const t = (text || '').toLowerCase();
  if (/research|analy|intel|scout|hunt|find|lead|market|recon/.test(t)) return 'research';
  if (/writ|messag|copy|propos|content|email|draft|architect|letter/.test(t)) return 'writing';
  if (/pipeline|track|crm|close|deal|ops|operation|fund|metric|report/.test(t)) return 'ops';
  if (/proof|case|brand|engine|design|story|portfolio|award/.test(t)) return 'studio';
  return 'generic';
}

export default function PixelOffice({ agent, state = 'idle', seed = 0 }) {
  const look = mulberry32(xfnv1a('look:' + (agent.name || agent.id || 'x')));
  const skin = pick(look, SKINS);
  const hair = pick(look, HAIRS);
  const shirt = pick(look, SHIRTS);
  const hairStyle = pick(look, ['short', 'short', 'cap', 'long', 'bald']);

  const room = mulberry32((xfnv1a('room:' + (agent.id || 'x')) ^ ((seed * 2654435761) >>> 0)) >>> 0);
  const wall = pick(room, WALLS);
  const floor = pick(room, FLOORS);
  const rug = pick(room, RUGS);
  const [woodTop, woodFront] = pick(room, WOODS);
  const leftProp = pick(room, ['picture', 'window', 'picture']);
  const hasPlant = chance(room, 0.7);
  const plantX = 116 + Math.floor(room() * 8);
  const kit = kitFor((agent.name || '') + ' ' + (agent.role || ''));

  // themed right-wall prop
  let themed = null;
  if (kit === 'research') {
    const books = [];
    for (let s = 0; s < 3; s++) {
      let bx = 95;
      const shelfY = 14 + s * 9;
      while (bx < 110) {
        const w = 2 + Math.floor(room() * 2);
        const h = 5 + Math.floor(room() * 2);
        books.push(<rect key={`b${s}-${bx}`} x={bx} y={shelfY + (7 - h)} width={w} height={h} fill={pick(room, BOOKS)} />);
        bx += w + 1;
      }
    }
    themed = (
      <g>
        <rect x={93} y={10} width={20} height={31} fill={woodFront} />
        <rect x={93} y={12} width={20} height={1} fill="#00000022" />
        <rect x={93} y={21} width={20} height={1} fill="#00000022" />
        <rect x={93} y={30} width={20} height={1} fill="#00000022" />
        {books}
      </g>
    );
  } else if (kit === 'ops') {
    const bars = [10, 16, 8, 20, 13].map((h, i) => <rect key={i} x={97 + i * 4} y={34 - h} width={3} height={h} fill={pick(room, BOOKS)} />);
    themed = (
      <g>
        <rect x={92} y={10} width={24} height={26} fill="#fbfbf7" />
        <rect x={92} y={10} width={24} height={26} fill="none" stroke="#bdb7a8" strokeWidth="1" />
        <rect x={96} y={34} width={16} height={1} fill="#9a9484" />
        {bars}
      </g>
    );
  } else if (kit === 'writing') {
    const notes = [];
    for (let i = 0; i < 5; i++) notes.push(<rect key={i} x={94 + (i % 3) * 7} y={13 + Math.floor(i / 3) * 9} width={6} height={7} fill={pick(room, ['#fff7d6', '#dbeeff', '#ffe0e0', '#e3ffe0'])} />);
    themed = (
      <g>
        <rect x={91} y={10} width={24} height={24} fill="#9c7a4e" />
        <rect x={93} y={12} width={20} height={20} fill="#caa477" />
        {notes}
      </g>
    );
  } else if (kit === 'studio') {
    themed = (
      <g>
        <rect x={96} y={12} width={16} height={20} fill={woodFront} />
        <rect x={98} y={14} width={12} height={16} fill="#fff" />
        <rect x={101} y={20} width={6} height={8} fill="#d9a93f" />
        <rect x={100} y={16} width={8} height={4} fill="#d9a93f" />
        <rect x={102} y={28} width={4} height={3} fill="#a8801f" />
      </g>
    );
  } else {
    themed = (
      <g>
        <rect x={95} y={14} width={18} height={3} fill={woodFront} />
        <rect x={95} y={24} width={18} height={3} fill={woodFront} />
        <rect x={98} y={9} width={5} height={5} fill="#5a8f5a" />
        <rect x={100} y={6} width={1} height={3} fill="#3f6f3f" />
        <rect x={104} y={18} width={6} height={6} fill={pick(room, BOOKS)} />
      </g>
    );
  }

  const leftWall = leftProp === 'window'
    ? (
      <g>
        <rect x={16} y={11} width={20} height={17} fill="#9fb6c9" />
        <rect x={16} y={11} width={20} height={17} fill="none" stroke="#cfd6dd" strokeWidth="1" />
        <rect x={25} y={11} width={1} height={17} fill="#cfd6dd" />
        <rect x={16} y={19} width={20} height={1} fill="#cfd6dd" />
        <rect x={18} y={13} width={6} height={4} fill="#c7e0f0" />
      </g>
    )
    : (
      <g>
        <rect x={18} y={12} width={16} height={14} fill={woodFront} />
        <rect x={20} y={14} width={12} height={10} fill="#fbfbf7" />
        <text x={26} y={23} fontSize="9" textAnchor="middle">{agent.emoji || '🙂'}</text>
      </g>
    );

  const bubble = state === 'busy'
    ? (<g className="po-bubble"><rect x={82} y={14} width={16} height={9} rx={2} fill="#ffffff" stroke="#00000022" /><rect x={85} y={18} width={2} height={2} fill="#6b8f71" /><rect x={89} y={18} width={2} height={2} fill="#6b8f71" /><rect x={93} y={18} width={2} height={2} fill="#6b8f71" /><rect x={84} y={22} width={3} height={3} fill="#ffffff" stroke="#00000022" /></g>)
    : state === 'done'
      ? (<g className="po-bubble"><rect x={83} y={13} width={14} height={11} rx={2} fill="#ffffff" stroke="#00000022" /><path d="M86 18 l2 2 l4 -4" fill="none" stroke="#4f7a52" strokeWidth="2" /><rect x={85} y={23} width={3} height={3} fill="#ffffff" stroke="#00000022" /></g>)
      : null;

  return (
    <svg className={`po po--${state}`} viewBox="0 0 140 72" xmlns="http://www.w3.org/2000/svg" role="img" aria-label={`${agent.name} office`}>
      {/* room */}
      <rect x={0} y={0} width={140} height={48} fill={wall} />
      <rect x={0} y={48} width={140} height={24} fill={floor} />
      <rect x={0} y={47} width={140} height={1} fill="#0000001a" />
      {leftWall}
      {themed}
      {hasPlant && (
        <g>
          <rect x={plantX} y={54} width={9} height={10} fill="#b9774a" />
          <rect x={plantX + 1} y={46} width={7} height={9} fill="#5a8f5a" />
          <rect x={plantX - 1} y={49} width={3} height={5} fill="#4f7f4f" />
          <rect x={plantX + 7} y={49} width={3} height={5} fill="#4f7f4f" />
        </g>
      )}
      {/* rug */}
      <rect x={44} y={62} width={54} height={8} fill={rug} opacity="0.85" />
      <rect x={44} y={62} width={54} height={1} fill="#ffffff44" />

      {/* character behind desk */}
      <g className="po-char">
        {/* arms */}
        <g className="po-arm">
          <rect x={57} y={36} width={4} height={11} fill={shirt} />
          <rect x={79} y={36} width={4} height={11} fill={shirt} />
          <rect x={57} y={45} width={4} height={2} fill={skin} />
          <rect x={79} y={45} width={4} height={2} fill={skin} />
        </g>
        {/* torso */}
        <rect x={61} y={34} width={18} height={14} fill={shirt} />
        <rect x={61} y={34} width={18} height={2} fill="#ffffff22" />
        {/* head */}
        <rect x={64} y={22} width={12} height={12} fill={skin} />
        <rect x={67} y={28} width={2} height={2} fill="#3a2a20" />
        <rect x={71} y={28} width={2} height={2} fill="#3a2a20" />
        {/* hair */}
        {hairStyle !== 'bald' && <rect x={63} y={20} width={14} height={4} fill={hair} />}
        {hairStyle === 'short' && (<><rect x={63} y={20} width={2} height={6} fill={hair} /><rect x={75} y={20} width={2} height={6} fill={hair} /></>)}
        {hairStyle === 'long' && (<><rect x={62} y={20} width={3} height={13} fill={hair} /><rect x={75} y={20} width={3} height={13} fill={hair} /></>)}
        {hairStyle === 'cap' && (<><rect x={62} y={19} width={16} height={4} fill={shirt} /><rect x={62} y={23} width={8} height={1} fill="#00000033" /></>)}
      </g>

      {/* desk in front */}
      <rect x={46} y={48} width={48} height={5} fill={woodTop} />
      <rect x={46} y={53} width={48} height={13} fill={woodFront} />
      <rect x={46} y={48} width={48} height={1} fill="#ffffff33" />
      {/* laptop on desk, right of head */}
      <g>
        <rect x={78} y={40} width={12} height={7} fill="#3a3f4a" />
        <rect x={79} y={41} width={10} height={5} fill="#9fd0d6" className="po-screen" />
        <rect x={77} y={47} width={14} height={2} fill="#2a2e36" />
      </g>

      {bubble}
    </svg>
  );
}