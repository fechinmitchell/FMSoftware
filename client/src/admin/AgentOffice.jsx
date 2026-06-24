import { useRef, useEffect } from 'react';

function xfnv1a(str) { let h = 2166136261 >>> 0; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const chance = (rng, p) => rng() < p;

const SKINS = ['#f3cda6', '#e6b08c', '#cf9b6f', '#b07a4e', '#8d5a34', '#ffd9b8'];
const HAIRS = ['#2b1b0e', '#4f3318', '#7a4a1e', '#a8662c', '#d9b87a', '#1a1a1a', '#9a9a9a', '#5b3a8c'];
const SHIRTS = ['#c0563f', '#4f7a52', '#3f6fb0', '#b08a3f', '#7c5cbf', '#3f9aa0', '#b0506f', '#5a6b8c', '#c97b5a', '#6b8f71'];
const WALLS = ['#e9e3d5', '#dbe3e9', '#e7dde9', '#dde9de', '#e9ded7', '#e3e0ea'];
const FLOORS = ['#d8c7a8', '#cdb79a', '#bcc4b4', '#d2c4ac'];
const RUGS = ['#b9543f', '#4f7a76', '#7c5cbf', '#3f6fb0', '#c08a3f'];
const WOODS = ['#9b6b43', '#8a5a3a', '#a87a4e'];
const BOOKS = ['#c0563f', '#4f7a52', '#3f6fb0', '#b08a3f', '#7c5cbf', '#b0506f'];

const W = 280, H = 140;

function kitFor(text) {
  const t = (text || '').toLowerCase();
  if (/research|analy|intel|scout|hunt|find|lead|market|recon/.test(t)) return 'research';
  if (/writ|messag|copy|propos|content|email|draft|architect|letter/.test(t)) return 'writing';
  if (/pipeline|track|crm|close|deal|ops|operation|fund|metric|report|commander/.test(t)) return 'ops';
  if (/proof|case|brand|engine|design|story|portfolio|award/.test(t)) return 'studio';
  return 'generic';
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

function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

function drawBubble(ctx, x, y, type, frame) {
  ctx.fillStyle = '#ffffff'; roundRect(ctx, x - 12, y - 10, 24, 15, 3); ctx.fill();
  ctx.fillRect(x - 3, y + 4, 4, 3);
  if (type === 'think' || type === 'work') {
    for (let i = 0; i < 3; i++) { ctx.globalAlpha = i <= frame ? 1 : 0.3; ctx.fillStyle = '#6b8f71'; ctx.fillRect(x - 7 + i * 5, y - 4, 3, 3); }
    ctx.globalAlpha = 1;
  } else if (type === 'read') {
    ctx.fillStyle = '#c0563f'; ctx.fillRect(x - 6, y - 6, 5, 9);
    ctx.fillStyle = '#4f7a52'; ctx.fillRect(x + 1, y - 6, 5, 9);
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(x - 1, y - 6, 1, 9);
  } else if (type === 'done') {
    ctx.strokeStyle = '#4f7a52'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 5, y - 2); ctx.lineTo(x - 1, y + 2); ctx.lineTo(x + 6, y - 5); ctx.stroke();
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
  ctx.textAlign = 'center'; ctx.font = '13px system-ui, sans-serif'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(c.emoji, x, y - 21);
  if (c.bubble) drawBubble(ctx, x, y - 30, c.bubble, c.bubbleFrame);
}

export default function AgentOffice({ agent, seed = 0 }) {
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const agentRef = useRef(agent);

  useEffect(() => { agentRef.current = agent; }, [agent]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const look = mulberry32(xfnv1a('look:' + (agent.name || agent.id || 'x')));
    const room = mulberry32((xfnv1a('room:' + (agent.id || 'x')) ^ ((seed * 2654435761) >>> 0)) >>> 0);
    const theme = {
      skin: pick(look, SKINS), hair: pick(look, HAIRS), shirt: pick(look, SHIRTS),
      wall: pick(room, WALLS), floor: pick(room, FLOORS), rug: pick(room, RUGS), wood: pick(room, WOODS),
      plant: chance(room, 0.7), kit: kitFor((agent.name || '') + ' ' + (agent.role || '')),
      books: Array.from({ length: 12 }, () => pick(room, BOOKS)),
    };
    const desk = { standX: 200, standY: 116 };
    const loiter = [
      { x: 52, y: 52, dir: 'u', act: 'read' },
      { x: 120, y: 96, dir: 'd', act: 'think' },
      { x: 64, y: 116, dir: 'r', act: 'idle' },
      { x: 236, y: 64, dir: 'l', act: 'think' },
    ];
    const char = {
      x: desk.standX, y: desk.standY, targetX: desk.standX, targetY: desk.standY,
      skin: theme.skin, hair: theme.hair, shirt: theme.shirt, emoji: agent.emoji || '🙂',
      speed: 38, dir: 'd', moving: false, walkT: Math.random() * 2,
      mode: 'act', timer: 0.5 + Math.random() * 1.5, actType: 'idle', targetDir: 'd', bubble: null, bubbleFrame: 0,
    };
    stateRef.current = { theme, desk, loiter, char, last: 0, t: 0 };

    function drawRoom() {
      const th = theme;
      ctx.fillStyle = th.floor; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(0,0,0,0.05)'; for (let x = 0; x < W; x += 28) ctx.fillRect(x, 28, 1, H - 28);
      ctx.fillStyle = th.wall; ctx.fillRect(0, 0, W, 28);
      ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.fillRect(0, 27, W, 2);
      // rug
      ctx.fillStyle = th.rug; ctx.fillRect(96, 70, 90, 44); ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fillRect(96, 70, 90, 2);
      // themed wall prop top-left
      if (th.kit === 'research') {
        ctx.fillStyle = th.wood; ctx.fillRect(16, 4, 70, 22);
        ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(16, 12, 70, 1); ctx.fillRect(16, 20, 70, 1);
        let bx = 19, row = 0;
        for (let i = 0; i < th.books.length; i++) { const w = 3 + (i % 2); ctx.fillStyle = th.books[i]; ctx.fillRect(bx, 5 + row * 8, w, 6); bx += w + 1; if (bx > 80) { bx = 19; row++; if (row > 2) break; } }
      } else if (th.kit === 'ops') {
        ctx.fillStyle = '#fbfbf7'; ctx.fillRect(16, 5, 64, 20); ctx.strokeStyle = '#b8b09a'; ctx.lineWidth = 1; ctx.strokeRect(16.5, 5.5, 63, 19);
        [9, 14, 7, 16].forEach((h, i) => { ctx.fillStyle = th.books[i]; ctx.fillRect(24 + i * 9, 23 - h, 5, h); });
      } else if (th.kit === 'writing') {
        ctx.fillStyle = '#9c7a4e'; ctx.fillRect(16, 5, 60, 20); ctx.fillStyle = '#caa477'; ctx.fillRect(18, 7, 56, 16);
        for (let i = 0; i < 5; i++) { ctx.fillStyle = ['#fff7d6', '#dbeeff', '#ffe0e0', '#e3ffe0'][i % 4]; ctx.fillRect(22 + (i % 3) * 16, 9 + Math.floor(i / 3) * 8, 7, 6); }
      } else if (th.kit === 'studio') {
        ctx.fillStyle = th.wood; ctx.fillRect(30, 5, 22, 20); ctx.fillStyle = '#fff'; ctx.fillRect(32, 7, 18, 16);
        ctx.fillStyle = '#d9a93f'; ctx.fillRect(37, 13, 8, 9); ctx.fillRect(36, 9, 10, 4);
      } else {
        ctx.fillStyle = th.wood; ctx.fillRect(20, 9, 56, 3); ctx.fillRect(20, 19, 56, 3);
        ctx.fillStyle = '#5a8f5a'; ctx.fillRect(28, 4, 6, 5); ctx.fillStyle = th.books[0]; ctx.fillRect(44, 14, 7, 7);
      }
      // plant
      if (th.plant) { ctx.fillStyle = '#b9774a'; ctx.fillRect(248, 104, 11, 11); ctx.fillStyle = '#5a8f5a'; ctx.fillRect(249, 95, 9, 10); ctx.fillStyle = '#4f7f4f'; ctx.fillRect(246, 98, 3, 6); ctx.fillRect(258, 98, 3, 6); }
      // desk bottom-right + monitor
      const d = desk;
      ctx.fillStyle = th.wood; ctx.fillRect(d.standX - 38, d.standY - 26, 76, 26);
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(d.standX - 38, d.standY - 4, 76, 4);
      ctx.fillStyle = '#3a3f4a'; ctx.fillRect(d.standX - 10, d.standY - 22, 20, 11);
      ctx.fillStyle = '#9fd0d6'; ctx.fillRect(d.standX - 8, d.standY - 20, 16, 7);
    }

    let raf;
    const frame = (ts) => {
      const s = stateRef.current;
      const dt = Math.min(0.05, s.last ? (ts - s.last) / 1000 : 0);
      s.last = ts; s.t += dt;
      const a = agentRef.current;
      const c = s.char;
      c.bubbleFrame = Math.floor(s.t * 2) % 3;
      if (a && a.busy) {
        c.targetX = s.desk.standX; c.targetY = s.desk.standY;
        moveToward(c, dt); if (arrived(c)) { c.dir = 'u'; c.moving = false; }
        c.bubble = 'work'; c.mode = 'walk';
      } else if (a && a.result && !a.busy) {
        // finished: hang near desk, show a check now and then
        if (c.mode === 'walk') { moveToward(c, dt); if (arrived(c)) { c.mode = 'act'; c.timer = 3; c.dir = c.targetDir || 'd'; } c.bubble = null; }
        else { c.timer -= dt; c.moving = false; c.bubble = c.actType === 'idle' ? 'done' : c.actType; if (c.timer <= 0) { const dest = s.loiter[Math.floor(Math.random() * s.loiter.length)]; c.targetX = dest.x; c.targetY = dest.y; c.targetDir = dest.dir; c.actType = dest.act; c.mode = 'walk'; } }
      } else {
        if (c.mode === 'walk') { moveToward(c, dt); c.bubble = null; if (arrived(c)) { c.mode = 'act'; c.timer = 2 + Math.random() * 4; c.dir = c.targetDir || 'd'; } }
        else { c.timer -= dt; c.moving = false; c.bubble = c.actType && c.actType !== 'idle' ? c.actType : null; if (c.timer <= 0) { const dest = s.loiter[Math.floor(Math.random() * s.loiter.length)]; c.targetX = dest.x; c.targetY = dest.y; c.targetDir = dest.dir; c.actType = dest.act; c.mode = 'walk'; } }
      }
      drawRoom();
      drawChar(ctx, c);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [seed, agent.id]);

  return <canvas ref={canvasRef} width={W} height={H} className="mc__canvas" />;
}