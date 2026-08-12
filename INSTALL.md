# Agent HQ — install

Two themes (The Office, Command Deck), one engine. Drop these files into your repo.

## 1. Copy files

New files (copy the whole folders in):
```
client/src/admin/hq/hqStore.js          ← the engine (state, versions, kaizen, routing, approvals)
client/src/admin/hq/AgentHQ.jsx         ← home screen + theme switcher + approvals
client/src/admin/hq/AgentEditor.jsx     ← per-agent editor + create-agent builder
client/src/admin/hq/OutputDrawer.jsx    ← slide-in output drawer
client/src/admin/hq/hq.css
client/src/admin/hq/themes/OfficeTheme.jsx
client/src/admin/hq/themes/DeckTheme.jsx
client/scripts/build-blog.mjs           ← blog static page + sitemap builder
server/hq.js                            ← new endpoints (route/kaizen/improve/build/publish)
```

Replaced files (overwrite yours — diffs are small):
```
client/src/admin/AdminApp.jsx   ← tabs are now: Agent HQ (home) + Agent Flow
server/index.js                 ← mounts /api/admin/hq
```

Your old MissionControl / RunsPage / WorkflowBuilder files stay in the repo untouched —
nothing imports them anymore, so rollback is just restoring the old AdminApp.jsx.

## 2. package.json (client)

Change the build script so blog pages + sitemap generate on every deploy:
```json
"build": "node scripts/build-blog.mjs && vite build"
```
Also create an empty folder `client/blog/` (posts land here as .md files).

## 3. Server env (server/.env)

Already have: ANTHROPIC_API_KEY, ADMIN_PASSWORD, JWT_SECRET.
Add for blog publishing:
```
GITHUB_TOKEN=github_pat_…    # fine-grained token, Contents: read+write on your site repo only
GITHUB_REPO=fechinmitchell/YOUR-REPO-NAME
GITHUB_BRANCH=main
```

## 4. Run it

```
cd server && npm run dev     # or node index.js
cd client && npm run dev
```
Open /tools → Agent HQ is home. Theme switcher top right.

## How the loop works

- **Run** always runs the agent's current version. Model "Auto" = the master
  routes it (Haiku call, heuristic fallback) and the reason is logged on the run.
- **✨ New version** rewrites role+task from the last output + your critique.
  Old versions stay as pills — click to roll back.
- **kaizen.md** per agent fills itself after each run (Haiku pulls 1–2 lessons)
  and is injected into every future run. Rejection notes go in too.
- **Blog Writer** in draft mode → post lands in 📥 Approvals → Approve & publish
  commits `client/blog/<slug>.md` to GitHub → Vercel rebuilds → the post is live
  at fmsoftware.ie/blog/<slug>/ with sitemap + robots.txt. Flip to automatic in
  the agent editor when you trust it.
- Approve/reject decisions append to the **master's kaizen** (view it at the
  bottom of the Approvals panel) and feed future routing.

## Notes

- The Express server is still dev-only (not deployed) — agents run when the
  server runs locally. Serverless-ifying /api/admin/* is the known TODO.
- Blog pages are plain static HTML served by Vercel before the SPA rewrite,
  so no vercel.json change is needed as long as your rewrite is a `rewrites`
  entry (filesystem wins first). Check /blog/ after the first deploy.
- HQ state lives in localStorage under `fm_hq_v1` (same browser = same agents).
