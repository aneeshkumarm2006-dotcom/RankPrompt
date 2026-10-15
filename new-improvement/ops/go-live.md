# Go-live settings (TODO 9.1)

These are the exact values for switching the **existing** Render service and Vercel project from v1 to v2 (D-018). [cutover.md](cutover.md) gives the order of the steps; this file gives the values. Keep the old values somewhere (a screenshot of each settings page is enough): rolling back means putting them back.

Commands are PowerShell, run from the repo root on a checkout of `main`.

---

## 0. Before you start

1. **v2 is on GitHub `main`** and CI is green. Render and Vercel build from GitHub, so the switch needs the `apps/`, `packages/` and root files pushed. Until the settings change, pushing them doesn't affect the live site: both services keep building `backend/` and `frontend/` with npm.
2. **MongoDB Database Tools** are installed (for the dumps): `winget install MongoDB.DatabaseTools`, then open a new terminal. Check with `mongodump --version`. If they aren't on `PATH`, set `$env:MONGO_TOOLS_DIR` to their `bin` folder.
3. **Generate two secrets** and keep them in your password manager. Run this twice:
   ```powershell
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```
   - the first value is `JWT_ACCESS_SECRET` (Render only);
   - the second value is `EDGE_PROXY_SECRET` (the same value on Render **and** Vercel).
4. **Write down from the current Render service** (Environment tab) the values you will copy: `MONGODB_URI`, `FRONTEND_URL`, `GOOGLE_CLIENT_ID`, `OPENAI_API_KEY`, `PERPLEXITY_API_KEY`, `GEMINI_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, the six `STRIPE_*PRICE_ID*` values, and the service URL (`https://<name>.onrender.com`, top of the service page).
5. **Stripe mode.** D-018 says test mode. If the current `STRIPE_SECRET_KEY` starts with `sk_live_`, stop and decide: either keep live mode (real charges) or switch to the test key and test price ids. A test key needs a **test-mode** webhook endpoint at the same URL, with its own `whsec_…`.

## 1. Dump the old database (TODO 9.4)

This is a read-only dump of the v1 `promptverse` database, kept outside the repo. It's also the backup before switching that D-027 asks for: the v2 database `promptverse_v2` is still empty at this point (D-015), so there's nothing else to back up yet.

```powershell
$env:MONGODB_URI = '<v1 MONGODB_URI from Render; it ends in /promptverse>'
pnpm db:backup dump --out "$HOME\pv-backups"
Remove-Item Env:MONGODB_URI
```

This writes `promptverse-<UTC time>.archive.gz` plus a `.manifest.json` (collection counts and indexes) to `%USERPROFILE%\pv-backups`. The URI reaches `mongodump` through a temporary file, never the command line. Keep the archive until the old database is dropped (9.8).

If you'd rather use raw `mongodump`: `mongodump --uri "<v1 URI>" --db promptverse --archive="$HOME\pv-backups\v1-promptverse.archive.gz" --gzip`. The URI is then visible in your shell history.

## 2. Render: the existing backend service

### Settings tab

| Setting | v1 value (now) | v2 value |
|---|---|---|
| Root Directory | `backend` | *(empty)* |
| Build Command | `npm install` (or similar) | `npx --yes pnpm@11.7.0 install --frozen-lockfile --prod=false && npx --yes pnpm@11.7.0 --filter "@pv/server..." build` |
| Start Command | `node server.js` / `npm start` | `node --enable-source-maps apps/server/dist/main.js` |
| Health Check Path | *(whatever is set)* | `/api/ready` |
| Auto-Deploy | on commit | unchanged |

Why each part:
- `pnpm@11.7.0` is pinned through `npx` so the build doesn't depend on Corepack or on Render's preinstalled pnpm. The lockfile and `pnpm-workspace.yaml` (`allowBuilds`) need pnpm 11.
- `--prod=false`: with `NODE_ENV=production` set, pnpm would skip devDependencies, and the build needs `tsup` and `typescript`.
- `@pv/server...` builds the server and the workspace packages it depends on. `tsup` bundles `@pv/*` into `apps/server/dist/main.js`; everything else loads from `node_modules`.

Verified locally (2026-10-15): this build, then this start command with `NODE_ENV=production` against a fresh replica set, gives `/api/ready` → `{"ok":true,…,"worker":{"enabled":true,…}}`.

### Environment tab

Delete every v1 variable that isn't in the table below, then set these. "Copy" means the same value as the v1 variable named.

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `NODE_VERSION` | `22` (otherwise Render may choose a newer Node from `engines`) |
| `APP_URL` | copy `FRONTEND_URL`: the live web origin, for example `https://app.example.com`, no trailing slash |
| `MONGODB_URI` | copy v1 `MONGODB_URI`, but change the database in the path from `/promptverse` to `/promptverse_v2` (keep everything after `?`) |
| `JWT_ACCESS_SECRET` | the first value from step 0.3 (new; don't reuse v1 `JWT_SECRET`) |
| `EDGE_PROXY_SECRET` | the second value from step 0.3. **Add it only in step 5**, after the Vercel middleware is live |
| `GOOGLE_CLIENT_ID` | copy `GOOGLE_CLIENT_ID` |
| `OPENAI_API_KEY` | copy `OPENAI_API_KEY` |
| `PERPLEXITY_API_KEY` | copy `PERPLEXITY_API_KEY` |
| `GEMINI_API_KEY` | copy `GEMINI_API_KEY` (a paid key; the free tier allows 20 requests a day) |
| `ANTHROPIC_API_KEY` | your Anthropic key (new to v2; same key as in `apps/server/.env`) |
| `DATAFORSEO_LOGIN` / `DATAFORSEO_PASSWORD` | the DataForSEO API login and password (n8n held these in v1; same values as in `apps/server/.env`) |
| `STRIPE_SECRET_KEY` | copy `STRIPE_SECRET_KEY` (see step 0.5) |
| `STRIPE_WEBHOOK_SECRET` | copy `STRIPE_WEBHOOK_SECRET` (the existing endpoint's signing secret) |
| `STRIPE_PRICE_STARTER` / `_PRO` / `_AGENCY` | copy `STRIPE_PRICE_ID_STARTER` / `_PRO` / `_AGENCY` |
| `STRIPE_PRICE_TOPUP_50` / `_100` / `_200` | copy `STRIPE_TOPUP_PRICE_ID_50` / `_100` / `_200` |
| `STRIPE_PORTAL_CONFIGURATION_ID` | optional: the `bpc_…` id from `pnpm admin stripe-portal --yes` (TODO 6.8) |
| `CLAUDE_EFFORT` | `low` (the default, but set it so it's visible; Q-001) |

Leave unset unless you want them: `RESEND_API_KEY` / `EMAIL_FROM` (without a key, emails go to the log, D-018), `SENTRY_DSN`, `PROVIDER_LIMITS`, `PROVIDER_DAILY_CAP_USD`, `WORKER_CONCURRENCY`, and every other default in [env-vars.md](env-vars.md).

Variables to delete (v1 only): `FRONTEND_URL`, `JWT_SECRET`, `JWT_EXPIRE`, `JWT_COOKIE_EXPIRE`, `GOOGLE_CLIENT_SECRET`, `STRIPE_PUBLISHABLE_KEY`, every `STRIPE_PRICE_ID_*` and `STRIPE_TOPUP_PRICE_ID_*`, every `N8N_*`, and every `SUPABASE_*`. Leave `PORT` unset: Render sets it.

The server refuses to start if a required variable is missing and names the variable in the deploy log (never its value).

## 3. Index sync (once, after the first v2 deploy)

Production connects with `autoIndex` off, so the indexes are built by this command. Run it once after the first deploy, and again whenever a schema adds an index. The dry run only prints the plan.

```powershell
$env:NODE_ENV = 'production'
$env:MONGODB_URI = '<the new v2 URI, ending in /promptverse_v2>'
pnpm admin sync-indexes          # dry run: lists the indexes it would create
pnpm admin sync-indexes --yes    # creates the 19 collections and their indexes
pnpm admin sync-indexes          # should now show nothing to create or drop
Remove-Item Env:MONGODB_URI, Env:NODE_ENV
```

`NODE_ENV=production` keeps the admin script from reading `apps/server/.env`. The `jobs` TTL index needs MongoDB 6.0 or newer on the cluster (Atlas → cluster → version).

## 4. Vercel: the existing project

### Settings → Build and Deployment

| Setting | v1 value (now) | v2 value |
|---|---|---|
| Framework Preset | Vite | Vite |
| Root Directory | `frontend` | `apps/web` |
| Include files outside the root directory in the Build Step | — | **Enabled** (the workspace lives above `apps/web`) |
| Install Command | `npm install` | `npx --yes pnpm@11.7.0 install --frozen-lockfile` |
| Build Command | `npm run build` | `npx --yes pnpm@11.7.0 --filter "@pv/web..." build` |
| Output Directory | `dist` | `dist` |
| Node.js Version | — | `22.x` |

`apps/web/vercel.json` (in the repo) adds the security headers and the SPA fallback for every path except `/api/*`. `apps/web/middleware.ts` (Vercel Routing Middleware) handles `/api/*`: it rewrites to `API_ORIGIN` and adds the `x-pv-edge-secret` header. There is no `/api` rewrite in `vercel.json` any more, so the Render host isn't hard-coded in the repo.

### Settings → Environment Variables (Production)

| Variable | Value |
|---|---|
| `VITE_GOOGLE_CLIENT_ID` | unchanged (same client id as the server's `GOOGLE_CLIENT_ID`) |
| `API_ORIGIN` | the Render service URL from step 0.4, for example `https://<name>.onrender.com` (no path, no trailing slash) |
| `EDGE_PROXY_SECRET` | the second value from step 0.3; mark it **Sensitive** |
| `VITE_SENTRY_DSN` | optional; leave unset |

Delete: `VITE_API_URL`, `VITE_N8N_WEBHOOK_URL`, `VITE_STRIPE_PUBLISHABLE_KEY`.

Until `API_ORIGIN` and `EDGE_PROXY_SECRET` are set, every `/api` call answers `503 UPSTREAM_UNAVAILABLE` ("The API proxy is not configured"), never the HTML page. That makes a missing variable easy to spot.

## 5. Switch the client-IP check on (D-027 follow-up)

The Render URL stays public because the Stripe webhook calls it directly, so a request sent straight to Render can put any address in `X-Forwarded-For`. With `EDGE_PROXY_SECRET` set on Render, the API trusts `X-Forwarded-For` only on requests that carry the secret, which means requests from the Vercel middleware. Every other request is rate-limited on the address Render saw connect. A wrong or missing secret never blocks a request: at worst, everyone is rate-limited as the Vercel address, as one client.

Order:
1. Vercel is deployed with `API_ORIGIN` and `EDGE_PROXY_SECRET` (step 4). Check that `https://<live domain>/api/ready` shows `"ok":true`.
2. Add `EDGE_PROXY_SECRET` (the same value) on Render, and let it redeploy. The deploy log no longer shows the warning `EDGE_PROXY_SECRET is not set`.
3. Check the IP. Sign in on the live site, then in the Render logs find your `POST /api/auth/login` line. Its `x-forwarded-for` should be `<your public IP>, <a Vercel address>`; compare with https://api.ipify.org. Then run `curl.exe -s -o NUL -w "%{http_code}" https://<name>.onrender.com/api/health -H "X-Forwarded-For: 1.2.3.4"` (prints `200`). That line's `x-forwarded-for` in the log now shows only your own address, not `1.2.3.4`: the forged entry was dropped. The secret header itself never appears in logs.

Rollback for this step alone: delete `EDGE_PROXY_SECRET` on Render.

## 6. Stripe

In the Stripe dashboard (the mode chosen in step 0.5) → Developers → Webhooks → the existing endpoint `https://<name>.onrender.com/api/stripe/webhook`. Check that these events are enabled: `checkout.session.completed`, `invoice.paid` (or v1's `invoice.payment_succeeded`), `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`. The URL and signing secret don't change.

## 7. Smoke test (TODO 9.6)

On the live domain, in a private window:

| # | Check | Pass when |
|---|---|---|
| 1 | `https://<live domain>/api/ready` | `"ok":true`, `db.ok`, `worker.enabled` |
| 2 | Register with email | Redirected to the app; the verify link is in the Render log (`email` line) or in your inbox if Resend is set |
| 3 | Open the verify link | Account verified; 50 signup credits in the sidebar (the signup bonus) |
| 4 | Sign out, sign in with Google | Same account, or a new one if the address differs |
| 5 | New brand → analyze → categories → prompts | Summary and categories appear; prompts are generated |
| 6 | Run 5 prompts × 5 platforms | Estimate shown; the run finishes; credits are charged, and refunded for any failed check |
| 7 | Report | Tiles, charts and the matrix show; answer and citation modals open; PDF and XLSX download |
| 8 | Share link | Opens signed out in another browser; revoking it gives 404 |
| 9 | Top-up (test card `4242 4242 4242 4242`) | Credits are added after the redirect back (webhook) |
| 10 | Daily schedule for the next hour | It runs at that hour and creates a run (on the free tier it can be late while the service sleeps) |
| 11 | `pnpm admin reconcile` with the v2 `MONGODB_URI` (as in step 3) | No mismatches |

Send Claude the run id from #6 and any failing row; `pnpm admin inspect-run --run <id>` shows the detail.

## Rollback

Until 9.8 drops the old database:
1. Put the v1 settings back on Render and Vercel (the screenshots), and redeploy. If 9.7 has already removed `backend/` and `frontend/`, deploy from the `v1-final` tag.
2. Re-activate the n8n workflows.

The v1 database `promptverse` isn't touched by v2. Anything written to `promptverse_v2` stays there for the next attempt.
