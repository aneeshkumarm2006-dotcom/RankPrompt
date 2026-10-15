# 01: System overview

## Topology

```
                         ┌────────────────────────── Render (existing service) ─────────────────────────┐
 Browser ── HTTPS ──►    │  /api/*         apps/server  (one Node process, RUN_WORKER=true)             │
 web origin (Vercel,     │   ├─ HTTP API (Express 5)  ── auth, brands, prompts, runs, insights, billing │
   apps/web; rewrites    │   ├─ Worker   ── claims jobs from Mongo, calls providers, writes results     │
                         │   └─ Scheduler + Sweeper ── 60 s ticks: due schedules, stuck runs, leases    │
                         └───────┬───────────────┬───────────────┬────────────────┬────────────────────┘
                                 │               │               │                │
                          MongoDB Atlas     AI providers      Stripe            Resend
                          (existing         OpenAI, Perplexity, (webhooks →     (optional;
                           cluster, v2 DB)  Gemini, Anthropic,  /api/stripe/webhook) log driver by default)
                                            DataForSEO
```

- **Web app:** served by Vercel as a static SPA on the current live domain. It calls `/api/*` on its own origin, and Vercel Routing Middleware (`apps/web/middleware.ts`) proxies those requests to the Render service with a secret header (D-018, D-028).
- **Same origin:** the browser only talks to one origin, so the auth cookies are first-party and host-only (`SameSite=Lax`).
- **Splitting the worker out:** set `RUN_WORKER=false` on the web service and add a Render Background Worker running the same build with `RUN_WORKER=true` and `RUN_HTTP=false`. No code changes.
- **Overlapping instances:** during a deploy Render runs the old and new instance side by side. Everything stateful lives in Mongo and every transition is atomic, so overlap is safe (see 04).

## Monorepo layout

```
/ (repo root, branch v2)
├─ apps/
│  ├─ server/                 Express 5 + Mongoose 8 + TS
│  │  ├─ src/main.ts          boot: env → db → http (if RUN_HTTP) → worker+scheduler (if RUN_WORKER)
│  │  ├─ src/config/          env (zod), logger (pino), sentry
│  │  ├─ src/db/              connection, workspace-scope plugin, transactions helper
│  │  ├─ src/http/            app factory, middleware (auth ctx, validate, rate-limit, origin check, errors)
│  │  ├─ src/modules/<name>/  routes.ts · controller.ts · service.ts · repo.ts · model.ts · mapper.ts
│  │  │     auth · workspaces · brands · prompts · runs · insights · shares · schedules
│  │  │     billing · credits · referrals · survey · notifications · plans · health
│  │  ├─ src/jobs/            queue (claim/lease/retry), worker loop, handlers/<jobType>.ts, scheduler, sweeper
│  │  ├─ src/emails/          Resend client + templates
│  │  └─ scripts/             admin scripts (adjust credits, rerun failed checks, inspect run)
│  └─ web/                    React 19 + Vite + TS + Tailwind
│     ├─ src/app/             router, layout (sidebars), providers (QueryClient, theme, auth)
│     ├─ src/lib/api/         typed client: fetch wrapper + zod parse, query keys
│     ├─ src/components/ui/   shared presentational components (modals, tables, badges, charts)
│     └─ src/features/        landing · auth · brands · prompts · runs · reports · insights
│                             schedules · billing · credits · settings · promo
├─ packages/
│  ├─ shared/                 zod schemas (requests/responses), enums (Platform, RunStatus…),
│  │                          plans.ts, pricing.ts, metrics.ts, countries.ts, languages.ts
│  └─ engine/                 adapters/<platform>.ts, extract.ts, match.ts, clean.ts, score.ts,
│                             cost.ts, version.ts, cli/ (run prompts, export XLSX)
├─ new-improvement/           these docs
├─ backend/ frontend/         v1 (reference only; deleted at cutover)
├─ pnpm-workspace.yaml · tsconfig.base.json · eslint.config.js · .github/workflows/ci.yml
```

## Dependency rules

These are enforced by ESLint `no-restricted-imports` and by TS project references.

- `packages/shared` depends on nothing internal. It holds pure types, zod schemas and pure functions.
- `packages/engine` depends on `shared` only. It knows nothing about Mongo or Express.
- `apps/server` depends on `shared` and `engine`.
- `apps/web` depends on `shared` only, never on `engine`.
- Inside the server, only `repo.ts` files may import `model.ts`. Controllers call services, and services call repos and other services.
- A Mongoose document never leaves a repo. Mappers turn documents into the response types defined in `shared`.

## Request flow (HTTP)

```
request → helmet/cors → requestId+pino → rate limit → origin check (non-GET)
        → cookie auth → ctx {userId, workspaceId, role} → zod validate (body/query/params)
        → controller → service → repo (workspace-scoped) → mapper → JSON envelope
errors  → AppError(code, status) → { error: { code, message } }   (no stack traces or internals in production)
```

## Core flows

**1. New brand → first run**

1. `POST /brands/analyze {name, url}` returns `{domain, summary, categories[], aliases[]}`. This is a synchronous call, under about 20 s.
2. `POST /brands` saves the brand (enforcing the plan's brand limit). `PUT /brands/:id/competitors` is optional.
3. `POST /brands/:id/prompts/generate {categories, count}` returns draft prompts. `POST /brands/:id/prompts` saves the chosen ones.
4. `POST /runs/estimate` returns the cost and current balance. Then `POST /runs` (with an Idempotency-Key) creates the run. It is created `queued` or `running`, and the jobs are enqueued.
5. The web app moves to `/app/runs/:id` and polls `GET /runs/:id` every 2 s. Progress is shown live. When the run finishes, the page shows the report (`GET /runs/:id/results`, plus insights).

**2. Worker check**

1. Claim the `check` job. Load the run config and brand matchers.
2. The adapter (`engine`) calls the provider.
3. Extract the vendor list, then match and score.
4. Write the `run_results` doc (fenced) and the raw response (TTL collection).
5. Complete the job.

**3. Finalize**

1. When the last check is done (or the sweeper notices), the `finalize` job runs.
2. It computes run aggregates and refunds failed checks.
3. It sets the final status, and queues notifications for scheduled runs.

**4. Schedule**

1. A tick claims a due schedule and advances its `nextRunAt` in the same update.
2. It resolves the prompt selection and creates a run in the same way as `POST /runs` with `trigger: 'scheduled'`.
3. If credits are short, the run is skipped, the skip is counted, and an email is sent.

**5. Billing**

1. Stripe sends a webhook to `/api/stripe/webhook`.
2. It is deduped in `stripe_events`.
3. The handler re-fetches the subscription from Stripe and applies the plan and credit changes through the ledger.

## Cross-cutting choices

| Concern | Choice |
|---|---|
| Validation | zod schemas in `shared` are used by the server middleware and the web forms |
| Config | `config/env.ts` parses `process.env` with zod at boot and fails fast if anything is missing |
| Logging | pino as JSON with request ids, and redaction of cookies, auth headers and API keys |
| Errors | `AppError` classes with typed codes. Express 5 forwards async errors. Sentry captures 5xx and job failures |
| Time | Everything is stored in UTC. Schedules store an IANA timezone and an hour |
| IDs | Mongo ObjectIds, exposed as strings. Share tokens are 32 random bytes in base64url, stored only as SHA-256 |
| Versioning | `engineVersion` and `metricsVersion` on runs, `schemaVersion` on results |
| Testing | Vitest (unit) and supertest with `MongoMemoryReplSet` (integration, transactions) on the server. Playwright for e2e, run locally and in CI with fake providers |
