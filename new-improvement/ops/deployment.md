# Deployment

**Scope (D-018):** v2 runs on the services that already host v1. There are no new accounts, no staging environment and no DNS changes. All code is on `main`. Until go-live, the live services keep building v1 from `backend/` and `frontend/`, so pushing v2 code doesn't change the live site.

## Render (API, worker and scheduler): the existing service

At go-live (P9), change these settings on the **existing** backend service. There's no `render.yaml` Blueprint: the settings are applied by hand. The exact values, env var by env var, are in [go-live.md](go-live.md).

| Setting | v2 value |
|---|---|
| Root directory | *(empty: repo root)* |
| Build command | `npx --yes pnpm@11.7.0 install --frozen-lockfile --prod=false && npx --yes pnpm@11.7.0 --filter "@pv/server..." build` |
| Start command | `node --enable-source-maps apps/server/dist/main.js` |
| Health check path | `/api/ready` |
| Node version | `NODE_VERSION=22` (also in `.nvmrc`) |
| Env vars | see [env-vars.md](env-vars.md) |

- One process runs the API, the worker and the scheduler (`RUN_WORKER=true`).
- Deploys overlap the old and new instance. The design is safe for this (see architecture/04).
- If the service is on the free tier, it sleeps when idle and schedules can run late. That's accepted for the beta (D-018).
- **Scaling out later:** set `RUN_WORKER=false` on the web service, then add a worker service with the same build and `RUN_HTTP=false`.

### Client IP and rate limits (07, 8.3)
`trust proxy` is 2 in production (browser → Vercel middleware → Render proxy → app). The Render URL stays public (the Stripe webhook uses it), so a request sent straight to it could forge `X-Forwarded-For`. The Vercel middleware (`apps/web/middleware.ts`) adds an `x-pv-edge-secret` header, and with `EDGE_PROXY_SECRET` set the API trusts `X-Forwarded-For` only on requests that carry it; on any other request the header is cut down to the address Render saw, which becomes `req.ip` (`edgeProxyGuard`, D-028). Login / register / Google keep their backstop keyed on that hop (200 per 15 min, D-027). After go-live, check `req.ip` against a known client IP ([go-live.md](go-live.md) § 5).

### Load test (8.1)
`pnpm loadtest` runs 3 × 150 prompts × 5 platforms on fake providers with realistic latency and 429s (about 12 minutes; `LOAD_TIME_SCALE=5` is a quicker, rougher check). Re-run it after changing `PROVIDER_LIMITS`, `WORKER_CONCURRENCY` or the queue.

### Admin scripts (TODO 4.10)
These run from a checkout of `main`, against the database in `MONGODB_URI` (from the shell, or `apps/server/.env` outside production). Production DB access is user-run: an agent prepares the command and you run it. Commands that write do nothing without `--yes`; they print what they would change.

| Command | What it does |
|---|---|
| `pnpm admin inspect-run --run <runId>` | Read-only: status, credits, checks per platform and error code, job states, the run's ledger rows, and whether the workspace ledger balances |
| `pnpm admin recompute-aggregates --run <runId> --yes` | Rebuilds a finished run's counts and aggregates from its results (no credit change) |
| `pnpm admin rerun-failed --run <runId> --yes` | Re-queues a finished run's failed checks and charges them again; finalize refunds any that fail again (D-023) |
| `pnpm admin adjust-credits --workspace <id> --bucket plan\|purchased --delta <±n> --note "<why>" --yes` | An `admin_adjust` ledger row plus the balance change (never below zero) |

The `jobs` TTL index uses a `$in` partial filter, which needs MongoDB 6.0 or newer on the cluster.

## Vercel (web): the existing project

At go-live, change these settings on the **existing** project:

| Setting | v2 value |
|---|---|
| Root directory | `apps/web` |
| Include files outside the root directory | enabled |
| Install | `npx --yes pnpm@11.7.0 install --frozen-lockfile` |
| Build | `npx --yes pnpm@11.7.0 --filter "@pv/web..." build` |
| Output | `dist` |
| Node.js version | 22.x |
| Env vars | `VITE_GOOGLE_CLIENT_ID`, `API_ORIGIN` (the Render URL), `EDGE_PROXY_SECRET`; optionally `VITE_SENTRY_DSN` |

**`apps/web/middleware.ts`** (Vercel Routing Middleware, `/api/:path*` only): rewrites `/api/*` to `API_ORIGIN` with the same path and query and adds the `x-pv-edge-secret` header. The browser only ever talks to its own origin, so the auth cookies are first-party (D-018). Without `API_ORIGIN` or `EDGE_PROXY_SECRET` it answers 503 instead of proxying (D-028).

**`apps/web/vercel.json`:**
- SPA fallback to `/index.html` for every path except `/api/*`.
- The security headers listed in 07 (CSP etc.).

The domains stay as they are today.

## MongoDB Atlas: the existing cluster

- v2 uses a **new database name** on the existing cluster: `promptverse_v2`. The v1 `promptverse` DB isn't touched (D-015).
- Atlas clusters are replica sets, so transactions work on every tier. The queue polls gently enough for the current tier.
- **Indexes:** production connects with `autoIndex` off, so `pnpm admin sync-indexes` (dry run) then `pnpm admin sync-indexes --yes` (`Model.syncIndexes()` for every model) builds them, with the production `MONGODB_URI` and `NODE_ENV=production` in the shell. Run it once at go-live and again whenever a schema adds an index; tests sync their own.
- **Backups (8.4):** `pnpm db:backup` wraps the MongoDB Database Tools (`winget install MongoDB.DatabaseTools`, or `brew install mongodb-database-tools`; or set `MONGO_TOOLS_DIR`). The user runs it against production:
  - `MONGODB_URI=<prod URI with /promptverse_v2> pnpm db:backup dump` writes `backups/promptverse_v2-<UTC time>.archive.gz` (git-ignored) and a `.manifest.json` with every collection's count and indexes. Read-only. The URI goes to `mongodump` through a temporary config file, never the command line.
  - `MONGODB_URI=<same> pnpm db:backup restore --archive backups/<file>.archive.gz --to pv_restore_check --yes` restores into a **scratch** database on the same cluster (the name must contain `restore` or `scratch`; it can't be the source), then checks collections, counts and indexes against the manifest and runs the ledger reconciliation on the copy. Without `--yes` it only prints the plan. Drop the scratch database afterwards (Atlas UI → Collections → drop `pv_restore_check`).
  - Tested on a local replica set (`apps/server/test/backup.test.ts`, which runs when the tools are installed): dump → restore twice → counts, indexes, BSON types and ledger all match.
  - Suggested rhythm for the beta: a dump before go-live and before any admin write; Atlas's own snapshots (if the tier has them) cover the rest.

## Stripe: the existing account

- Development uses **test mode** with the existing v1 test price ids.
- **Webhook:** the existing endpoint at `<render-host>/api/stripe/webhook` keeps working, because v2 serves the same path. Events:
  - `checkout.session.completed`
  - `invoice.paid`
  - `invoice.payment_failed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`

  Check that these 5 events are enabled on the existing endpoint at go-live. v1's `invoice.payment_succeeded` works in place of `invoice.paid` (D-025), and `checkout.session.async_payment_succeeded` is handled if enabled.
- **Customer Portal:** once per Stripe mode, `pnpm admin stripe-portal` (dry run), then `pnpm admin stripe-portal --yes`. Put the printed `bpc_…` id in `STRIPE_PORTAL_CONFIGURATION_ID`. Without it, upgrades get their extra plan credits only at the next cycle (D-025).
- **Local testing:**
  - automated: `apps/server/test/billing.test.ts` replays the 06 matrix with signed test events (`pnpm test`);
  - against the real test account: start `pnpm dev`, run `stripe listen --forward-to localhost:4000/api/stripe/webhook`, put the `whsec_…` it prints in `STRIPE_WEBHOOK_SECRET`, then buy with card `4242 4242 4242 4242` (or `4000 0000 0000 0341` for a failing renewal). `stripe trigger` events use customers v2 doesn't know, so they are acknowledged and ignored.
- **Ledger check:** `pnpm admin reconcile` runs the nightly reconciliation on demand (read-only).

## Email

- The `log` driver is the default: emails are written to the log and `email_log`.
- To send real email later, set `RESEND_API_KEY` and `EMAIL_FROM`. No code change is needed (D-018).

## Google OAuth

- Uses the existing client id. Add `http://localhost:5173` as an authorized origin for local dev if it isn't there already.

## Sentry

- Optional. If `SENTRY_DSN` / `VITE_SENTRY_DSN` are empty, Sentry is off.

## CI (GitHub Actions, `.github/workflows/ci.yml`)

- **On every push and PR to `main`:**
  - `pnpm install --frozen-lockfile`
  - `pnpm -r typecheck`
  - `pnpm -r lint`
  - `pnpm -r test` (Vitest; server integration uses `MongoMemoryReplSet`)
  - `pnpm -r build`
  - the Playwright suite with `FAKE_PROVIDERS=true` and a fake Stripe (smoke + billing, 8.5)
  - `secrets`: gitleaks 8.28 over the working tree and the whole git history (`.gitleaks.toml` skips the v1 folders)
- **No secrets in CI.** Provider keys aren't used; engine tests use recorded fixtures.
