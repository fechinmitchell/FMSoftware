// ------------------------------------------------------------------
//  FM Software — visit stats
//  Mounted at /api/stats in index.js
//  POST /hit        — public beacon from the site + blog pages
//  GET  /blogviews  — public, per-blog-path human view counts
//  GET  /summary    — auth'd, everything for the Stats page
//
//  Storage: in-memory aggregates flushed to /tmp every 15s. Survives
//  restarts on the same instance; resets on a fresh deploy. For
//  long-term numbers also enable Vercel Web Analytics (one click).
// ------------------------------------------------------------------
const express = require('express');
const fs = require('fs');
const { requireAuth } = require('./auth');

const router = express.Router();
const FILE = '/tmp/fm_stats.json';

// human-only aggregates (bots counted separately, flagged in recent)
let S = { total: 0, bots: 0, byDay: {}, byPath: {}, byCountry: {}, byRef: {}, recent: [] };
try { S = { ...S, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) }; } catch {}
let dirty = false;
const flusher = setInterval(() => {
  if (!dirty) return;
  try { fs.writeFileSync(FILE, JSON.stringify(S)); } catch {}
  dirty = false;
}, 15000);
if (flusher.unref) flusher.unref();

const BOT_RE = /bot|crawl|spider|slurp|bingpreview|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python-requests|python-urllib|go-http|java\/|okhttp|axios|scrapy|facebookexternalhit|whatsapp|telegram|discordbot|preview|gptbot|claudebot|anthropic|ccbot|bytespider|petalbot|semrush|ahrefs|mj12|dotbot|screaming frog|dataforseo|zoominfo/i;

// tiny per-IP limiter so the public beacon can't be spammed
const hitLog = new Map();
function allowHit(ip) {
  const now = Date.now();
  let e = hitLog.get(ip);
  if (!e || now > e.reset) { e = { n: 0, reset: now + 60000 }; hitLog.set(ip, e); }
  if (hitLog.size > 5000) hitLog.clear();
  return ++e.n <= 30;
}

const geoCache = new Map();
async function geo(ip) {
  if (!ip || ip === 'unknown' || ip.startsWith('127.') || ip === '::1') return 'Local';
  if (geoCache.has(ip)) return geoCache.get(ip);
  try {
    const r = await fetch(`http://ip-api.com/json/${ip}?fields=status,country`);
    const d = await r.json();
    const c = d.status === 'success' && d.country ? d.country : 'Unknown';
    if (geoCache.size > 2000) geoCache.clear();
    geoCache.set(ip, c);
    return c;
  } catch { return 'Unknown'; }
}

const day = () => new Date().toISOString().slice(0, 10);
const bump = (obj, k) => { obj[k] = (obj[k] || 0) + 1; };

router.post('/hit', async (req, res) => {
  res.json({ ok: true }); // never make the visitor wait
  try {
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || 'unknown';
    if (!allowHit(ip)) return;
    const { path: p = '/', ref = '' } = req.body || {};
    const cleanPath = String(p).slice(0, 120);
    const ua = req.headers['user-agent'] || '';
    const isBot = !ua || BOT_RE.test(ua);
    S.total++;
    if (isBot) { S.bots++; }
    else {
      const country = await geo(ip);
      bump(S.byDay, day());
      bump(S.byPath, cleanPath);
      bump(S.byCountry, country);
      let r2 = '';
      try { r2 = ref ? new URL(ref).hostname.replace(/^www\./, '') : ''; } catch { r2 = String(ref).slice(0, 60); }
      if (r2 && !r2.includes('fmsoftware')) bump(S.byRef, r2);
      S.recent.unshift({ at: Date.now(), path: cleanPath, country, ref: r2, bot: false });
      S.recent = S.recent.slice(0, 200);
      dirty = true;
      return;
    }
    // bots: keep a light trace in recent so you can see who's crawling
    S.recent.unshift({ at: Date.now(), path: cleanPath, country: 'Bot', ref: '', bot: true, ua: ua.slice(0, 70) });
    S.recent = S.recent.slice(0, 200);
    dirty = true;
  } catch {}
});

router.get('/blogviews', (req, res) => {
  const views = {};
  Object.entries(S.byPath).forEach(([k, v]) => { if (k.startsWith('/blog')) views[k] = v; });
  res.set('Cache-Control', 'public, max-age=60');
  res.json({ views });
});

router.get('/summary', requireAuth, (req, res) => {
  res.json({ ...S, humans: S.total - S.bots });
});

module.exports = router;