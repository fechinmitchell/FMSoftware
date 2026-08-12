// ------------------------------------------------------------------
//  Blog static builder — runs before `vite build`.
//  Reads client/blog/*.md (frontmatter + markdown), writes real
//  crawlable pages into client/public/blog/<slug>/index.html plus
//  a blog index and sitemap.xml. Vercel serves static files before
//  the SPA rewrite, so these pages are what Google crawls.
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

function parse(md) {
  const m = md.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!m) return null;
  const head = {};
  m[1].split('\n').forEach((l) => { const i = l.indexOf(':'); if (i > 0) head[l.slice(0, i).trim()] = l.slice(i + 1).trim(); });
  return { ...head, body: m[2].trim() };
}

/* minimal markdown → HTML (headings, bold, links, lists, paragraphs) */
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
    if (h) { flush(); if (inList) { html += '</ul>\n'; inList = false; } html += `<h${h[1].length + 1}>${inline(h[2])}</h${h[1].length + 1}>\n`; }
    else if (li) { flush(); if (!inList) { html += '<ul>\n'; inList = true; } html += `<li>${inline(li[1])}</li>\n`; }
    else if (!line.trim()) { flush(); if (inList) { html += '</ul>\n'; inList = false; } }
    else para.push(line.trim());
  }
  flush(); if (inList) html += '</ul>\n';
  return html;
}

const SHELL = (title, description, canonical, inner) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · FM Software</title>
<meta name="description" content="${description}">
<link rel="canonical" href="${canonical}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:type" content="article">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Karla:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  :root{--cream:#FAF6F0;--ink:#1E332A;--sage:#6B8F71;--sage-deep:#54775B;--clay:#C97B5A}
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--cream);color:var(--ink);font-family:'Karla',sans-serif;line-height:1.7}
  .wrap{max-width:720px;margin:0 auto;padding:2.5rem 1.4rem 5rem}
  .top{display:flex;align-items:center;justify-content:space-between;margin-bottom:2.5rem}
  .brand{font-family:'Fraunces',serif;font-weight:700;font-size:1.1rem;color:var(--ink);text-decoration:none}
  .brand span{color:var(--sage)}
  .cta{font-weight:700;font-size:.9rem;color:#fff;background:var(--sage);border-radius:999px;padding:.5rem 1.1rem;text-decoration:none}
  h1{font-family:'Fraunces',serif;font-weight:700;font-size:2.1rem;line-height:1.15;margin-bottom:.6rem}
  h2,h3,h4{font-family:'Fraunces',serif;font-weight:600;margin:2rem 0 .6rem}
  p{margin:.9rem 0}ul{margin:.9rem 0 .9rem 1.3rem}li{margin:.35rem 0}
  a{color:var(--sage-deep)}
  .meta{color:rgba(30,51,42,.5);font-size:.9rem;margin-bottom:2rem}
  .foot{margin-top:3.5rem;padding-top:1.5rem;border-top:1px solid rgba(30,51,42,.12);font-size:.95rem}
  .postcard{display:block;background:#fff;border:1px solid rgba(30,51,42,.1);border-radius:14px;padding:1.2rem 1.4rem;margin:1rem 0;text-decoration:none;color:var(--ink)}
  .postcard:hover{border-color:var(--sage)}
  .postcard h2{margin:0 0 .3rem;font-size:1.25rem}
  .postcard p{margin:0;color:rgba(30,51,42,.7)}
</style>
</head>
<body>
<div class="wrap">
  <div class="top">
    <a class="brand" href="/">FM<span>·</span>Software</a>
    <a class="cta" href="/#contact">Start a project</a>
  </div>
  ${inner}
  <div class="foot">FM Software · custom software, automation and AI · Galway, Ireland · <a href="/">fmsoftware.ie</a></div>
</div>
</body>
</html>`;

// ---- build ----
mkdirSync(OUT_DIR, { recursive: true });
const posts = [];
if (existsSync(BLOG_DIR)) {
  for (const f of readdirSync(BLOG_DIR).filter((f) => f.endsWith('.md'))) {
    const p = parse(readFileSync(join(BLOG_DIR, f), 'utf8'));
    if (!p || !p.title) { console.warn(`blog: skipping ${f} (no frontmatter)`); continue; }
    const slug = (p.slug || f.replace(/\.md$/, '')).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const date = p.date || new Date().toISOString().slice(0, 10);
    posts.push({ slug, title: p.title, description: p.description || '', date });
    const inner = `<h1>${p.title}</h1><div class="meta">${date} · FM Software</div>${mdToHtml(p.body)}
      <p><a class="cta" href="/#contact">Need something like this built? Talk to me →</a></p>`;
    mkdirSync(join(OUT_DIR, slug), { recursive: true });
    writeFileSync(join(OUT_DIR, slug, 'index.html'), SHELL(p.title, p.description || p.title, `${SITE}/blog/${slug}/`, inner));
  }
}
posts.sort((a, b) => (a.date < b.date ? 1 : -1));

// blog index
const indexInner = `<h1>Notes from the studio</h1>
<div class="meta">Software, automation and AI for Irish businesses — written by the engineer who builds it.</div>
${posts.map((p) => `<a class="postcard" href="/blog/${p.slug}/"><h2>${p.title}</h2><p>${p.description}</p></a>`).join('\n') || '<p>First posts landing soon.</p>'}`;
writeFileSync(join(OUT_DIR, 'index.html'), SHELL('Blog', 'Notes on software, automation and AI from FM Software, Galway.', `${SITE}/blog/`, indexInner));

// sitemap
const urls = [`${SITE}/`, `${SITE}/blog/`, ...posts.map((p) => `${SITE}/blog/${p.slug}/`)];
writeFileSync(join(root, 'public', 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u}</loc></url>`).join('\n')}\n</urlset>\n`);
writeFileSync(join(root, 'public', 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);

console.log(`blog: built ${posts.length} post(s) + index + sitemap`);
