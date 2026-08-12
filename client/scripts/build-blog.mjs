// ------------------------------------------------------------------
//  Blog static builder — runs before `vite build`.
//  Reads client/blog/*.md (frontmatter + markdown), writes real
//  crawlable pages into client/public/blog/<slug>/index.html plus
//  a blog index, sitemap.xml and robots.txt.
//
//  Design: continuation of the main fmsoftware.ie page — same nav,
//  hills landscape, Fraunces + Karla, cream/sage/peach/clay, curved
//  divider, project-card style post cards.
//
//  package.json:  "build": "node scripts/build-blog.mjs && vite build"
// ------------------------------------------------------------------
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url))); // client/
const BLOG_DIR = join(root, 'blog');
const OUT_DIR = join(root, 'public', 'blog');
const SITE = 'https://fmsoftware.ie';

/* ---------------- markdown ---------------- */
function parse(md) {
  const m = md.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!m) return null;
  const head = {};
  m[1].split('\n').forEach((l) => { const i = l.indexOf(':'); if (i > 0) head[l.slice(0, i).trim()] = l.slice(i + 1).trim(); });
  return { ...head, body: m[2].trim() };
}

function mdToHtml(md) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (s) => esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\[(.+?)\]\((https?:\/\/[^)\s]+|\/[^)\s]*)\)/g, '<a href="$2">$1</a>');
  const lines = md.split('\n');
  let html = '', inList = false, para = [];
  const flush = () => { if (para.length) { html += `<p>${inline(para.join(' '))}</p>\n`; para = []; } };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = line.match(/^(#{1,4})\s+(.*)/);
    const li = line.match(/^[-*]\s+(.*)/);
    const q = line.match(/^>\s?(.*)/);
    if (h) { flush(); if (inList) { html += '</ul>\n'; inList = false; } html += `<h${h[1].length + 1}>${inline(h[2])}</h${h[1].length + 1}>\n`; }
    else if (li) { flush(); if (!inList) { html += '<ul>\n'; inList = true; } html += `<li>${inline(li[1])}</li>\n`; }
    else if (q) { flush(); if (inList) { html += '</ul>\n'; inList = false; } html += `<blockquote>${inline(q[1])}</blockquote>\n`; }
    else if (!line.trim()) { flush(); if (inList) { html += '</ul>\n'; inList = false; } }
    else para.push(line.trim());
  }
  flush(); if (inList) html += '</ul>\n';
  // the Kensei's sign-off, rendered as a proper byline card
  html = html.replace(/<p>\s*FMSoftware\s*[-–—·]\s*Kaizen AI Agent\s*<\/p>\s*$/i,
    `<div class="byline"><span class="byline__bot">🤖</span><span><strong>FMSoftware · Kaizen AI Agent</strong><br><small>Drafted by the studio's AI agent. Reviewed and approved by Fechín Mitchell before publishing.</small></span></div>\n`);
  return html;
}

const readMins = (text) => Math.max(2, Math.round(text.split(/\s+/).length / 220));
const fmtDate = (iso) => {
  const d = new Date(iso + 'T12:00:00');
  return isNaN(d) ? iso : d.toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' });
};

/* ---------------- shared page chrome ---------------- */
const CSS = `
  :root{--cream:#FAF6F0;--cream-deep:#F3EDE3;--surface:#fff;--ink:#1E332A;--ink-70:rgba(30,51,42,.72);
    --ink-50:rgba(30,51,42,.5);--ink-12:rgba(30,51,42,.12);--ink-07:rgba(30,51,42,.07);
    --sage:#6B8F71;--sage-deep:#54775B;--peach:#E8A87C;--clay:#C97B5A;
    --display:'Fraunces',Georgia,serif;--body:'Karla',sans-serif}
  *{box-sizing:border-box;margin:0;padding:0}
  html{scroll-behavior:smooth;-webkit-font-smoothing:antialiased}
  body{background:var(--cream);color:var(--ink);font-family:var(--body);line-height:1.7;overflow-x:hidden}
  a{color:var(--sage-deep)}
  .nav{position:sticky;top:0;z-index:20;display:flex;align-items:center;justify-content:space-between;gap:1rem;
    padding:.9rem clamp(1.2rem,4vw,3rem);background:rgba(250,246,240,.85);backdrop-filter:blur(12px);border-bottom:1px solid var(--ink-07)}
  .nav__brand{font-family:var(--display);font-weight:600;font-size:1.1rem;color:var(--ink);text-decoration:none}
  .nav__brand span{color:var(--sage);margin:0 1px}
  .nav__links{display:flex;gap:.3rem}
  .nav__link{font-size:.93rem;color:var(--ink-70);text-decoration:none;padding:.42rem .85rem;border-radius:999px}
  .nav__link:hover{color:var(--ink);background:var(--ink-07)}
  .nav__link--on{color:#fff;background:var(--sage)}
  @media (max-width:760px){.nav__link--mid{display:none}}
  .nav__cta{font-weight:700;font-size:.9rem;color:#fff;background:var(--sage);border-radius:999px;padding:.55rem 1.15rem;text-decoration:none;white-space:nowrap}
  .nav__cta:hover{background:var(--sage-deep)}

  .hero{position:relative;padding:clamp(3rem,7vw,5.5rem) 1.4rem clamp(4rem,9vw,7rem);overflow:hidden}
  .hero__inner{position:relative;z-index:2;max-width:760px;margin:0 auto}
  .eyebrow{font-size:.82rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--sage-deep);margin-bottom:.9rem}
  h1{font-family:var(--display);font-weight:600;font-size:clamp(2.1rem,5vw,3.1rem);line-height:1.12;letter-spacing:-.5px}
  h1 em{color:var(--sage-deep)}
  .lead{font-size:1.08rem;color:var(--ink-70);max-width:600px;margin-top:1rem}
  .postmeta{display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;font-size:.88rem;color:var(--ink-50);margin-top:1.1rem}
  .postmeta b{color:var(--sage-deep);font-weight:700}
  .hero__landscape{position:absolute;inset:auto 0 0 0;height:62%;z-index:1;pointer-events:none}
  .hero__landscape svg{width:100%;height:100%;display:block}
  .hill--back{fill:rgba(107,143,113,.10)}.hill--mid{fill:rgba(107,143,113,.16)}.hill--front{fill:rgba(107,143,113,.24)}
  .sun{fill:rgba(232,168,124,.55)}
  .birds path{stroke:rgba(30,51,42,.35);stroke-width:1.6;fill:none;stroke-linecap:round}

  .divider{max-width:760px;margin:-2.2rem auto 0;padding:0 1.4rem;color:var(--peach);position:relative;z-index:3}
  .divider svg{display:block;width:100%;height:34px;overflow:visible}
  .divider path{stroke-dasharray:1;stroke-dashoffset:0;animation:draw 1.4s ease both}
  @keyframes draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}

  .wrap{max-width:760px;margin:0 auto;padding:2rem 1.4rem 4.5rem;position:relative;z-index:2}
  @keyframes rise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
  .rise{animation:rise .65s cubic-bezier(.2,.7,.3,1) both}

  /* post cards — same language as the site's project cards */
  .postcard{display:block;background:var(--surface);border:1px solid var(--ink-12);border-radius:16px;overflow:hidden;
    text-decoration:none;color:var(--ink);margin-top:1.3rem;transition:transform .22s ease,box-shadow .22s ease,border-color .22s ease}
  .postcard:hover{transform:translateY(-4px);border-color:var(--sage);box-shadow:0 4px 8px rgba(30,51,42,.05),0 18px 42px rgba(30,51,42,.12)}
  .postcard__bar{display:flex;align-items:center;gap:.6rem;padding:.6rem 1rem;background:linear-gradient(135deg,#6B8F71,#54775B);color:#EAF4EC}
  .postcard__dots{display:flex;gap:5px;flex:none}.postcard__dots i{width:8px;height:8px;border-radius:50%;background:currentColor;opacity:.55}
  .postcard__url{font-size:.74rem;font-family:ui-monospace,Menlo,monospace;opacity:.85;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .postcard__body{display:block;padding:1.3rem 1.45rem 1.4rem}
  .postcard__meta{font-size:.82rem;color:var(--ink-50);margin-bottom:.55rem}
  .postcard h2{font-family:var(--display);font-weight:600;font-size:1.35rem;line-height:1.28;margin:0 0 .55rem}
  .postcard p{color:var(--ink-70);font-size:.97rem;margin:0}
  .postcard__read{display:inline-block;margin-top:.95rem;font-weight:700;font-size:.9rem;color:var(--sage-deep)}
  .postcard:hover .postcard__read{text-decoration:underline}

  /* article typography */
  article{font-size:1.04rem}
  article h2,article h3,article h4{font-family:var(--display);font-weight:600;line-height:1.25;margin:2.2rem 0 .7rem}
  article h2{font-size:1.6rem;padding-top:1.2rem;position:relative}
  article h2::before{content:'';position:absolute;top:0;left:0;width:44px;height:3px;border-radius:2px;background:var(--peach)}
  article h3{font-size:1.25rem}
  article p{margin:.95rem 0}
  article ul{margin:.95rem 0 .95rem 1.35rem}article li{margin:.4rem 0}
  article a{color:var(--sage-deep);text-decoration:underline;text-underline-offset:3px}
  article blockquote{border-left:3px solid var(--peach);background:var(--cream-deep);border-radius:0 12px 12px 0;
    padding:.85rem 1.15rem;margin:1.2rem 0;color:var(--ink-70);font-style:italic}
  article code{background:var(--cream-deep);border:1px solid var(--ink-07);border-radius:6px;padding:.1rem .4rem;
    font-size:.9em;font-family:ui-monospace,Menlo,monospace}
  .byline{display:flex;gap:.8rem;align-items:flex-start;margin-top:2.4rem;background:rgba(107,143,113,.08);
    border:1px solid rgba(107,143,113,.28);border-radius:14px;padding:1rem 1.15rem;font-size:.92rem;line-height:1.5}
  .byline__bot{font-size:1.5rem;line-height:1.2}
  .byline small{color:var(--ink-50)}

  .cta{margin-top:2.6rem;background:var(--surface);border:1px solid var(--ink-12);border-radius:18px;
    padding:1.7rem 1.8rem;box-shadow:0 2px 4px rgba(30,51,42,.04),0 14px 36px rgba(30,51,42,.08)}
  .cta h3{font-family:var(--display);font-weight:600;font-size:1.4rem;line-height:1.2}
  .cta p{color:var(--ink-70);margin:.5rem 0 1.1rem;max-width:480px}
  .btn{display:inline-flex;align-items:center;gap:.45rem;font-weight:700;font-size:.95rem;color:#fff;
    background:var(--sage);border-radius:999px;padding:.7rem 1.4rem;text-decoration:none}
  .btn:hover{background:var(--sage-deep)}
  .backlink{display:inline-block;margin-bottom:1.4rem;font-size:.9rem;font-weight:700;color:var(--ink-70);text-decoration:none}
  .backlink:hover{color:var(--sage-deep)}

  .footer{border-top:1px solid var(--ink-12);margin-top:2rem;padding:1.6rem clamp(1.2rem,4vw,3rem);
    display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;font-size:.88rem;color:var(--ink-50)}
  .footer__links{display:flex;gap:1.1rem}
  .footer__links a{color:var(--ink-70);text-decoration:none}
  .footer__links a:hover{color:var(--sage-deep);text-decoration:underline}
  @media (prefers-reduced-motion:reduce){.rise,.divider path{animation:none}}
`;

const LANDSCAPE = `
  <div class="hero__landscape" aria-hidden="true">
    <svg viewBox="0 0 1440 420" preserveAspectRatio="xMidYMax slice">
      <circle class="sun" cx="1140" cy="130" r="52"/>
      <g class="birds">
        <path d="M300 110 q 8 -8 16 0 q 8 -8 16 0"/>
        <path d="M360 90 q 7 -7 14 0 q 7 -7 14 0"/>
        <path d="M260 80 q 6 -6 12 0 q 6 -6 12 0"/>
      </g>
      <path class="hill--back" d="M0 320 C 240 220, 420 280, 640 240 S 1080 160, 1440 260 V 420 H 0 Z"/>
      <path class="hill--mid" d="M0 360 C 200 300, 480 330, 720 300 S 1180 250, 1440 330 V 420 H 0 Z"/>
      <path class="hill--front" d="M0 400 C 300 350, 600 380, 900 360 S 1280 330, 1440 380 V 420 H 0 Z"/>
    </svg>
  </div>`;

const DIVIDER = `
  <div class="divider" aria-hidden="true">
    <svg viewBox="0 0 600 40" preserveAspectRatio="none">
      <path pathLength="1" d="M0 30 C 120 6, 240 6, 320 22 S 520 38, 600 14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="600" cy="14" r="4" fill="currentColor"/>
    </svg>
  </div>`;

const NAV = (active) => `
  <nav class="nav">
    <a class="nav__brand" href="/">FM<span>·</span>Software</a>
    <div class="nav__links">
      <a class="nav__link" href="/#home">Home</a>
      <a class="nav__link nav__link--mid" href="/#services">What I Build</a>
      <a class="nav__link nav__link--mid" href="/#work">Work</a>
      <a class="nav__link nav__link--mid" href="/#studio">The Studio</a>
      <a class="nav__link nav__link--mid" href="/#contact">Contact</a>
      <a class="nav__link ${active === 'blog' ? 'nav__link--on' : ''}" href="/blog/">Blog</a>
    </div>
    <a class="nav__cta" href="/#contact">Start a project</a>
  </nav>`;

const FOOTER = `
  <footer class="footer">
    <p>© 2026 FM Software · Fechín Mitchell · Galway, Ireland</p>
    <div class="footer__links">
      <a href="/">Home</a>
      <a href="/blog/">Blog</a>
      <a href="https://github.com/fechinmitchell" target="_blank" rel="noopener noreferrer">GitHub</a>
      <a href="https://www.linkedin.com/in/fech%C3%ADn-mitchell/" target="_blank" rel="noopener noreferrer">LinkedIn</a>
    </div>
  </footer>`;

const SHELL = ({ title, description, canonical, body, type = 'article' }) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · FM Software</title>
<meta name="description" content="${description}">
<link rel="canonical" href="${canonical}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:type" content="${type}">
<meta property="og:site_name" content="FM Software">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,500&family=Karla:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${CSS}</style>
</head>
<body>
${body}
</body>
</html>`;

/* ---------------- build ---------------- */
mkdirSync(OUT_DIR, { recursive: true });
const posts = [];
if (existsSync(BLOG_DIR)) {
  for (const f of readdirSync(BLOG_DIR).filter((f) => f.endsWith('.md'))) {
    const p = parse(readFileSync(join(BLOG_DIR, f), 'utf8'));
    if (!p || !p.title) { console.warn(`blog: skipping ${f} (no frontmatter)`); continue; }
    const slug = (p.slug || f.replace(/\.md$/, '')).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const date = p.date || new Date().toISOString().slice(0, 10);
    const mins = readMins(p.body);
    posts.push({ slug, title: p.title, description: p.description || '', date, mins });

    const body = `
      ${NAV('blog')}
      <header class="hero">
        ${LANDSCAPE}
        <div class="hero__inner rise">
          <p class="eyebrow">Notes from the studio</p>
          <h1>${p.title}</h1>
          ${p.description ? `<p class="lead">${p.description}</p>` : ''}
          <p class="postmeta"><b>${fmtDate(date)}</b> · ${mins} min read · FM Software, Galway</p>
        </div>
      </header>
      ${DIVIDER}
      <main class="wrap">
        <a class="backlink" href="/blog/">← All notes</a>
        <article class="rise" style="animation-delay:.1s">
          ${mdToHtml(p.body)}
        </article>
        <div class="cta rise" style="animation-delay:.15s">
          <h3>Have a project in mind?</h3>
          <p>Whether it's an automation, an AI product or a full platform — tell me about it. No commitment, just a conversation.</p>
          <a class="btn" href="/#contact">Start a conversation →</a>
        </div>
      </main>
      ${FOOTER}`;
    mkdirSync(join(OUT_DIR, slug), { recursive: true });
    writeFileSync(join(OUT_DIR, slug, 'index.html'),
      SHELL({ title: p.title, description: p.description || p.title, canonical: `${SITE}/blog/${slug}/`, body }));
  }
}
posts.sort((a, b) => (a.date < b.date ? 1 : -1));

/* blog index */
const indexBody = `
  ${NAV('blog')}
  <header class="hero">
    ${LANDSCAPE}
    <div class="hero__inner rise">
      <p class="eyebrow">FM Software · Galway, Ireland</p>
      <h1>Notes from <em>the studio.</em></h1>
      <p class="lead">Software, automation and AI for Irish businesses — written from the workbench, not the marketing department.</p>
    </div>
  </header>
  ${DIVIDER}
  <main class="wrap">
    ${posts.map((p, i) => `
    <a class="postcard rise" style="animation-delay:${0.08 + i * 0.07}s" href="/blog/${p.slug}/">
      <div class="postcard__bar"><span class="postcard__dots"><i></i><i></i><i></i></span><span class="postcard__url">fmsoftware.ie/blog/${p.slug}</span></div>
      <div class="postcard__body">
        <div class="postcard__meta">${fmtDate(p.date)} · ${p.mins} min read</div>
        <h2>${p.title}</h2>
        <p>${p.description}</p>
        <span class="postcard__read">Read the note →</span>
      </div>
    </a>`).join('\n') || '<p style="color:rgba(30,51,42,.55)">First notes landing soon.</p>'}
  </main>
  ${FOOTER}`;
writeFileSync(join(OUT_DIR, 'index.html'),
  SHELL({ title: 'Notes from the studio', description: 'Notes on software, automation and AI for Irish businesses, from FM Software in Galway.', canonical: `${SITE}/blog/`, body: indexBody, type: 'website' }));

/* sitemap + robots */
const urls = [`${SITE}/`, `${SITE}/blog/`, ...posts.map((p) => `${SITE}/blog/${p.slug}/`)];
writeFileSync(join(root, 'public', 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u}</loc></url>`).join('\n')}\n</urlset>\n`);
writeFileSync(join(root, 'public', 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);

console.log(`blog: built ${posts.length} post(s) + index + sitemap`);