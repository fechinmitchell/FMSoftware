import { useRef, useEffect } from 'react';

/* deterministic look per agent name */
function xfnv1a(str) { let h = 2166136261 >>> 0; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

const SKINS = ['#f3cda6', '#e6b08c', '#cf9b6f', '#b07a4e', '#8d5a34', '#ffd9b8'];
const HAIRS = ['#2b1b0e', '#4f3318', '#7a4a1e', '#a8662c', '#d9b87a', '#1a1a1a', '#9a9a9a', '#5b3a8c'];
const SHIRTS = ['#c0563f', '#4f7a52', '#3f6fb0', '#b08a3f', '#7c5cbf', '#3f9aa0', '#b0506f', '#5a6b8c', '#c97b5a', '#6b8f71'];
const BOOKS = ['#c0563f', '#4f7a52', '#3f6fb0', '#b08a3f', '#7c5cbf', '#b0506f'];

const W = 640, H = 300;

function layout() {
  const deskCx = [95, 235, 375, 515];
  const rows = [110, 205];
  const desks = [];
  rows.forEach((ry) => deskCx.forEach((cx) => desks.push({ x: cx, y: ry, standX: cx, standY: ry + 40 })));
  const loiter = [
    { x: 110, y: 74, dir: 'u', act: 'read' },
    { x: 515, y: 74, dir: 'u', act: 'read' },
    { x: 350, y: 70, dir: 'u', act: 'think' },
    { x: 585, y: 250, dir: 'l', act: 'coffee' },
    { x: 300, y: 185, dir: 'd', act: 'think' },
    { x: 420, y: 175, dir: 'l', act: 'idle' },
    { x: 60, y: 235, dir: 'r', act: 'idle' },
  ];
  return { desks, loiter };
}

function makeChar(a, i, st) {
  const look = mulberry32(xfnv1a('look:' + (a.name || a.id || 'x')));
  const desk = st.desks[i % st.desks.length];
  return {
    id: a.id, name: a.name || 'Agent', emoji: a.emoji || '🙂',
    x: desk.standX, y: desk.standY, targetX: desk.standX, targetY: desk.standY,
    skin: pick(look, SKINS), hair: pick(look, HAIRS), shirt: pick(look, SHIRTS),
    speed: 44, dir: 'd', moving: false, walkT: Math.random() * 2,
    mode: 'act', timer: 1 + Math.random() * 2, actType: 'idle', targetDir: 'd',
    deskIndex: i, bubble: null, bubbleFrame: 0,
  };
}

function moveToward(c, dt) {
  const dx = c.targetX - c.x, dy = c.targetY - c.y, d = Math.hypot(dx, dy);
  if (d > 2) {
    const m = Math.min(c.speed * dt, d);
    c.x += (dx / d) * m; c.y += (dy / d) * m; c.moving = true; c.walkT += dt;
    c.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'r' : 'l') : (dy > 0 ? 'd' : 'u');
  } else c.moving = false;
}
const arrived = (c) => Math.hypot(c.targetX - c.x, c.targetY - c.y) <= 2;

function updateChar(c, dt, st, t, agents) {
  const a = agents.find((x) => x.id === c.id);
  const busy = !!a && a.busy;
  c.bubbleFrame = Math.floor(t * 2) % 3;
  if (busy) {
    const d = st.desks[c.deskIndex % st.desks.length];
    c.targetX = d.standX; c.targetY = d.standY;
    moveToward(c, dt);
    if (arrived(c)) { c.dir = 'u'; c.moving = false; }
    c.bubble = 'work'; c.mode = 'walk';
    return;
  }
  if (c.mode === 'walk') {
    moveToward(c, dt);
    c.bubble = null;
    if (arrived(c)) { c.mode = 'act'; c.timer = 2 + Math.random() * 4; c.dir = c.targetDir || 'd'; }
  } else {
    c.timer -= dt; c.moving = false;
    c.bubble = c.actType && c.actType !== 'idle' ? c.actType : null;
    if (c.timer <= 0) {
      const dest = st.loiter[Math.floor(Math.random() * st.loiter.length)];
      c.targetX = dest.x; c.targetY = dest.y; c.targetDir = dest.dir; c.actType = dest.act; c.mode = 'walk';
    }
  }
}

function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

function drawShelf(ctx, x, y) {
  ctx.fillStyle = '#7d5435'; ctx.fillRect(x, y, 80, 26);
  ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(x, y + 8, 80, 1); ctx.fillRect(x, y + 17, 80, 1);
  let bx = x + 3, row = 0;
  for (let i = 0; i < 22; i++) {
    const w = 3 + ((i * 7) % 3);
    ctx.fillStyle = BOOKS[i % BOOKS.length]; ctx.fillRect(bx, y + row * 9 + 1, w, 6);
    bx += w + 1; if (bx > x + 76) { bx = x + 3; row++; if (row > 2) break; }
  }
}
function drawPlant(ctx, x, y) {
  ctx.fillStyle = '#b9774a'; ctx.fillRect(x, y + 8, 12, 12);
  ctx.fillStyle = '#5a8f5a'; ctx.fillRect(x + 1, y - 2, 10, 11);
  ctx.fillStyle = '#4f7f4f'; ctx.fillRect(x - 2, y + 2, 4, 7); ctx.fillRect(x + 10, y + 2, 4, 7);
}
function drawDesk(ctx, d) {
  ctx.fillStyle = '#9b6b43'; ctx.fillRect(d.x - 40, d.y - 14, 80, 28);
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(d.x - 40, d.y + 10, 80, 4);
  ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(d.x - 40, d.y - 14, 80, 1);
  ctx.fillStyle = '#3a3f4a'; ctx.fillRect(d.x - 11, d.y - 11, 22, 12);
  ctx.fillStyle = '#9fd0d6'; ctx.fillRect(d.x - 9, d.y - 9, 18, 8);
  ctx.fillStyle = '#cbb08a'; ctx.fillRect(d.x + 18, d.y - 2, 8, 6);
}

function drawRoom(ctx, st) {
  ctx.fillStyle = '#d8c7a8'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(0,0,0,0.06)'; for (let x = 0; x < W; x += 32) ctx.fillRect(x, 38, 1, H - 38);
  ctx.fillStyle = '#c9bfa6'; ctx.fillRect(0, 0, W, 38);
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(0, 37, W, 2);
  ctx.fillStyle = '#b9543f'; ctx.fillRect(250, 150, 150, 80);
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(250, 150, 150, 2);
  drawShelf(ctx, 70, 6); drawShelf(ctx, 470, 6);
  ctx.fillStyle = '#fbfbf7'; ctx.fillRect(300, 6, 100, 24);
  ctx.strokeStyle = '#b8b09a'; ctx.lineWidth = 1; ctx.strokeRect(300.5, 6.5, 99, 23);
  ctx.fillStyle = '#4f7a52'; ctx.fillRect(312, 22, 8, 6);
  ctx.fillStyle = '#3f6fb0'; ctx.fillRect(324, 16, 8, 12);
  ctx.fillStyle = '#c0563f'; ctx.fillRect(336, 12, 8, 16);
  ctx.fillStyle = '#9fd0d6'; ctx.fillRect(590, 232, 18, 26);
  ctx.fillStyle = '#dff'; ctx.fillRect(594, 236, 10, 8);
  drawPlant(ctx, 16, 250); drawPlant(ctx, 610, 40);
  st.desks.forEach((d) => drawDesk(ctx, d));
}

function drawBubble(ctx, x, y, type, frame) {
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, x - 12, y - 10, 24, 15, 3); ctx.fill();
  ctx.fillRect(x - 3, y + 4, 4, 3);
  if (type === 'think' || type === 'work') {
    for (let i = 0; i < 3; i++) { ctx.globalAlpha = i <= frame ? 1 : 0.3; ctx.fillStyle = '#6b8f71'; ctx.fillRect(x - 7 + i * 5, y - 4, 3, 3); }
    ctx.globalAlpha = 1;
  } else if (type === 'read') {
    ctx.fillStyle = '#c0563f'; ctx.fillRect(x - 6, y - 6, 5, 9);
    ctx.fillStyle = '#4f7a52'; ctx.fillRect(x + 1, y - 6, 5, 9);
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(x - 1, y - 6, 1, 9);
  } else if (type === 'coffee') {
    ctx.fillStyle = '#8a5a3a'; ctx.fillRect(x - 5, y - 5, 8, 7);
    ctx.fillStyle = '#c9a'; ctx.fillRect(x + 3, y - 4, 2, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(x - 3, y - 8, 1, 2);
  }
}

function drawChar(ctx, c) {
  const bob = c.moving && Math.floor(c.walkT * 8) % 2 === 0 ? -1 : 0;
  const x = Math.round(c.x), y = Math.round(c.y) + bob;
  ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.beginPath(); ctx.ellipse(x, y + 9, 9, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3b3f4a'; ctx.fillRect(x - 5, y + 3, 4, 6); ctx.fillRect(x + 1, y + 3, 4, 6);
  ctx.fillStyle = c.shirt; ctx.fillRect(x - 7, y - 6, 14, 11);
  ctx.fillRect(x - 9, y - 5, 3, 8); ctx.fillRect(x + 6, y - 5, 3, 8);
  ctx.fillStyle = c.skin; ctx.fillRect(x - 9, y + 1, 3, 2); ctx.fillRect(x + 6, y + 1, 3, 2);
  ctx.fillStyle = c.skin; ctx.fillRect(x - 6, y - 18, 12, 13);
  ctx.fillStyle = c.hair;
  if (c.dir === 'u') ctx.fillRect(x - 6, y - 18, 12, 13);
  else { ctx.fillRect(x - 6, y - 18, 12, 5); ctx.fillRect(x - 6, y - 18, 2, 9); ctx.fillRect(x + 4, y - 18, 2, 9); }
  if (c.dir !== 'u') {
    ctx.fillStyle = '#3a2a20';
    if (c.dir === 'l') ctx.fillRect(x - 4, y - 12, 2, 2);
    else if (c.dir === 'r') ctx.fillRect(x + 2, y - 12, 2, 2);
    else { ctx.fillRect(x - 4, y - 12, 2, 2); ctx.fillRect(x + 2, y - 12, 2, 2); }
  }
  ctx.textAlign = 'center';
  ctx.font = '13px system-ui, sans-serif'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(c.emoji, x, y - 21);
  ctx.font = '600 9px system-ui, sans-serif'; ctx.fillStyle = 'rgba(40,35,30,0.85)';
  ctx.fillText(c.name.length > 12 ? c.name.slice(0, 11) + '…' : c.name, x, y + 23);
  if (c.bubble) drawBubble(ctx, x, y - 30, c.bubble, c.bubbleFrame);
}

export default function OfficeFloor({ agents }) {
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const agentsRef = useRef(agents);

  useEffect(() => {
    agentsRef.current = agents;
    const st = stateRef.current;
    if (!st) return;
    const ids = new Set(agents.map((a) => a.id));
    st.chars = st.chars.filter((c) => ids.has(c.id));
    agents.forEach((a, i) => {
      let c = st.chars.find((x) => x.id === a.id);
      if (!c) st.chars.push(makeChar(a, i, st));
      else { c.name = a.name || c.name; c.emoji = a.emoji || c.emoji; c.deskIndex = i; }
    });
  }, [agents]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const st = layout();
    st.chars = [];
    st.last = 0; st.t = 0;
    agentsRef.current.forEach((a, i) => st.chars.push(makeChar(a, i, st)));
    stateRef.current = st;

    let raf;
    const frame = (ts) => {
      const s = stateRef.current;
      const dt = Math.min(0.05, s.last ? (ts - s.last) / 1000 : 0);
      s.last = ts; s.t += dt;
      const ag = agentsRef.current;
      for (const c of s.chars) updateChar(c, dt, s, s.t, ag);
      drawRoom(ctx, s);
      s.chars.slice().sort((a, b) => a.y - b.y).forEach((c) => drawChar(ctx, c));
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvasRef} width={W} height={H} className="mc__canvas" />;
}