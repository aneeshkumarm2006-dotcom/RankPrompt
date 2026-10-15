# v2 build checklist

How to use this file:
- Tick a box in the same PR that does the work.
- A phase is done only when its **Exit criteria** are met.
- Feature IDs (F-xx) refer to [reference/feature-parity.md](reference/feature-parity.md). Decision IDs (D-xx) and open questions (Q-xx) refer to [DECISIONS.md](DECISIONS.md).

---

## P0: Planning docs ✅
- [x] Create the `new-improvement/` folder: README, CONTEXT, DECISIONS, CHECKLIST, architecture/01–10, ops/, reference/
- [x] Add a root `CLAUDE.md` pointing to these docs
- [x] User reviews the docs. Edits are recorded in DECISIONS.md. (Approved with no edits, D-017)
- [x] Resolve Q-004 (production domain): keep the current domains (D-018)

**Exit:** the user has approved the docs.

---

## P1: Foundations ✅
**Repo and tooling**
- [x] On `main`, next to v1 (no `v2` branch, D-018), add root `package.json`, `pnpm-workspace.yaml` (`apps/*`, `packages/*`), `.nvmrc` (Node 22), `.gitignore`, `.editorconfig`
- [x] `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`); packages ship TS source instead of project references (D-019)
- [x] ESLint flat config + Prettier
  - [x] Import boundaries: web must not import engine; models may only be imported by their repo
- [x] Vitest workspace config

**Packages and apps**
- [x] `packages/shared`:
  - [x] enums (`Platform`, `RunStatus`, `CheckStatus`, error codes)
  - [x] `countries.ts` (38) and `languages.ts` (18), from `Reports.jsx:144-189`
  - [x] `plans.ts` skeleton
- [x] `apps/server` skeleton:
  - [x] `config/env.ts` (zod, fail fast)
  - [x] pino logger with redaction
  - [x] Sentry, optional (off when `SENTRY_DSN` is empty)
  - [x] app factory with every route under `/api`, error envelope, `/api/health`, `/api/ready`
  - [x] graceful shutdown
- [x] `apps/server/db`: connection, transaction helper, `sanitizeFilter`, workspace-scope plugin skeleton
- [x] `apps/web` skeleton:
  - [x] Vite + TS + Tailwind (port `tailwind.config.js`, `index.css`, `ThemeContext`)
  - [x] router, QueryClient, typed `apiFetch` calling same-origin `/api`
  - [x] Vite dev proxy `/api` → `localhost:4000`; `vercel.json` rewrite `/api/*` → Render (D-018)

**Infrastructure**
- [x] Local dev without Docker: `pnpm db:dev` starts an in-memory Mongo replica set (`mongodb-memory-server`). `pnpm dev` runs DB, server and web together. A real `MONGODB_URI` in `.env` overrides it.
- [x] CI: `.github/workflows/ci.yml` (install, typecheck, lint, test, build)
- [x] `.env.example` for server and web (names only, per [ops/env-vars.md](ops/env-vars.md))
- [x] Guard v1: the new root files (`package.json`, `pnpm-workspace.yaml`, lockfile) must not change how the live v1 builds run from `backend/` and `frontend/` (npm). No root `render.yaml`; go-live settings are applied by hand (P9).
- [x] No staging environment and no new accounts (D-018). v1 keeps deploying from `backend/` and `frontend/`, so v2 commits to `main` don't change the live site.

**Exit:** CI is green on `main`; locally `/api/ready` is green and the web shell calls `/api/health` through the dev proxy with cookies; the live v1 site is unaffected.

---

## P2: Analysis engine + CLI (`packages/engine`)
**Core pieces**
- [x] `types.ts`: `AskInput`, `AnswerRaw`, `Citation`, `ProviderError` kinds
- [x] `clean.ts`: citation, markdown-link and URL stripping (port of `proseOf`), Perplexity `[n]` handling
- [x] `extract.ts`: shared vendor extractor (`gpt-5.4-mini`, strict json_schema), 2 retries
- [x] `match.ts`: Unicode alias matching, rank, cited (`tldts`), snippet, competitors, suggested competitors
- [x] `cost.ts` + `prices.ts`: per-check `costMicros`

**Adapters**
- [x] `chatgpt`: Responses API + `web_search` + `user_location`; utm stripping; dedupe
- [x] `perplexity`: Agent API `fast` preset (Sonar Chat Completions ended, D-020) + `user_location`; `[web:n]`-filtered `search_results`; legacy Sonar shape still parsed
- [x] `gemini`: google_search grounding; location in system instruction; domain taken from the citation title
- [x] `claude`: `web_search_20260209`, explicit `effort`, `pause_turn` loop (max 5), refusal handling, search error blocks, citations
- [x] `google_aio`: DataForSEO live/advanced; `ai_overview` item; `noAnswer`; ISO2 → `location_code` mapping (cached)

**Fixtures, CLI and measurement**
- [x] Fixtures for every case listed in [03 § Test fixtures](architecture/03-analysis-engine.md). Unit tests assert matcher output.
- [x] CLI: `ask`, `run` (resumable, concurrency, competitors file, prompts CSV), `export` (XLSX matching the luna export layout) (F-40)
- [ ] Hand-check: 50 real prompts × 5 platforms (one NDEX brand and one Canadim brand). Record agreement for mentioned, rank and cited.
- [ ] Measure the cost per check for each platform, from logged usage. Write the results into DECISIONS.
- [ ] **Resolve Q-001** (Claude model and credit weights) and **Q-002** (async AIO)

**Exit:** ≥95% agreement with the hand-check; all fixture tests pass; cost table recorded; Q-001 and Q-002 decided.

---

## P3: API core ✅
**Auth (F-02, F-03)**
- [x] Models + repos: users, sessions, auth_tokens, workspaces, memberships
- [x] Register and login (bcrypt 12, generic errors)
- [x] Cookie sessions: access JWT + rotating refresh with reuse detection
- [x] Logout and password change, both revoking sessions
- [x] Email verification and password reset. Emails go through the `log` mailer until P7 adds the email job (D-022).
- [x] Google sign-in (`email_verified`, explicit linking)
- [x] Signup transaction: user + workspace + membership + signup bonus ledger row (F-05) + pending referral (F-04)

**Request handling**
- [x] Middleware: ctx, zod validate, Origin check, rate limits (07 table), `trust proxy`
- [x] Workspace-scope plugin enforced. ESLint import boundary active.
- [x] `GET /me`, `PATCH /me`, `GET /plans`, `GET /meta`
- [x] Plan limits enforced server-side: brands, max prompts per run, allowed platforms per plan (F-36, F-37)

**Brands and prompts**
- [x] Brands:
  - [x] `POST /brands/analyze`: OpenAI web search, structured output → summary, ≤10 categories, aliases (F-07, F-08)
  - [x] Brands CRUD + competitors + plan brand limit (F-18, F-36)
  - [x] Archive pauses the brand's schedules
- [x] Prompts:
  - [x] Library: list, bulk add, edit-as-new-version, archive (D-014)
  - [x] `prompts/generate` (one structured call; fixes the v1 location bug) (F-09)
- [x] Cross-workspace isolation test suite covering every id route (the route list is read from the source, so a new id route fails CI until it's covered)

**Exit:** the integration suite passes, including cross-workspace 404s and signup atomicity (no half-created accounts on injected failure).

---

## P4: Runs, queue and insights ✅
**Queue and runs**
- [x] `jobs` collection + `queue.ts`: claim, lease renewal, fencing, retry policy by error kind, dedupeKey
- [x] Provider limiters (concurrency + RPM token bucket + AIMD on 429), workspace in-flight cap, daily spend caps (`provider_spend`)
- [x] `POST /runs/estimate`, and `POST /runs` in one transaction (idempotency key, guarded reserve, run + results + jobs) (F-11, F-12)
- [x] `check` handler (engine call, fenced write, raw TTL doc, last-check → finalize enqueue)
- [x] `finalize_run`: aggregates (05), refund by bucket, final status
- [x] Sweeper: lease recovery, stuck finalize, alerts. Graceful shutdown drain.
- [x] Cancel (F-41) and delete

**Reading results**
- [x] `GET /runs`, `/runs/:id` (live progress), `/runs/:id/results` (filters, cursor)
- [x] `packages/shared/metrics.ts` + unit tests (pooled totals, null handling, share of voice, AIO presence)
- [x] Insights: overview, trend (comparability hashes), competitors (F-21, F-42), sources (F-24), prompts history (F-22)
- [x] Shares: create / list / revoke; public trimmed DTO with `noindex` (F-14)
- [x] XLSX export (F-39)
- [x] Admin scripts: `adjust-credits`, `rerun-failed --run`, `recompute-aggregates --run`, `inspect-run`

**Exit:** chaos tests pass:
- a worker killed mid-run
- a forced lease expiry with two workers running the same check
- a 429 storm
- a simulated deploy overlap (2 instances)
- cancel mid-run
- finalize run twice

In every case the results are correct, nothing is double-counted, and ledger = balance. *(Met: `apps/server/test/chaos.test.ts`, plus the spend-cap hold and the sweeper's finalize recovery; D-023.)*

---

## P5: Web app (TS port, same look)
**Shell and auth**
- [x] App shell: layouts, sidebar with credits and plan from `useMe` (F-35), theme (F-32), Vercel analytics (F-34), 404, `/terms`, `/privacy`
- [x] Landing with `GET /plans` pricing (F-01)
- [x] Auth pages: login, register (`?ref=`), verify, forgot and reset password, Google (F-02, F-03, F-04)

**Brands, prompts and runs**
- [x] Brands list + brand settings: edit, aliases, competitors, archive (F-18)
- [x] Wizard: analyze → categories → prompts → run config + estimate + credit modals (F-06–F-12)
- [x] Prompt library page + per-prompt history (F-22)
- [x] Run config form, progress page with cancel, runs lists (all runs and per brand) (F-11, F-17, F-23, F-41)

**Reports, insights and the rest**
- [x] `ReportView`:
  - [x] tiles, charts, results matrix, answer/snippet/citation modals, server-side filters (F-13)
  - [x] share management (F-14)
  - [x] PDF (F-16) and XLSX buttons
- [x] Public `/share/:token` using `ReportView readOnly` (F-15)
- [x] Brand overview (F-19, F-20), competitors tab (F-21, F-42), sources page (F-24)
- [x] Schedules UI (F-25) (works against the P7 API; can be built before the scheduler exists)
- [x] Billing page (F-29), credits page with ledger, referral and survey (F-28, F-31), settings with profile, password and sessions (F-28)
- [x] Promo popup triggered by run creation (F-33)
- [x] v1 path redirects (`/reports/:id`, `/brands/:id/dashboard`, `/shared/:token`)

**Testing**
- [x] Playwright smoke suite, run locally and in CI: signup → brand → run (stubbed providers via a `FAKE_PROVIDERS=true` flag) → report → share

**Exit:** every keep/fix/replace/new row in feature-parity.md is ticked by the user on a local copy. *(Built, D-024. Waiting on the user's click-through, TODO 5.15. Rows that need Stage 6/7 endpoints (F-25, F-26, F-27, F-29, F-30, F-31 survey) can only be ticked after those stages.)*

---

## P6: Billing
- [x] Stripe client (pinned API version), lazy customer per workspace
- [x] Checkout (rejects an existing subscription), top-up, portal, subscription info (F-29, F-30)
- [x] Webhook: raw body, signature check, `stripe_events` dedupe/processing state, a handler for each event in [06](architecture/06-credits-and-billing.md)
- [x] Credit buckets: plan reset on `invoice.paid`, upgrade top-up, plan → 0 when the subscription ends, purchased credits kept
- [x] Referral credit on verification; survey grant in a transaction (F-04, F-31)
- [x] Nightly reconciliation job (ledger = balance) with a Sentry alert
- [ ] Uses the existing Stripe account in test mode and the existing v1 price ids (D-018). Webhook path stays `/api/stripe/webhook`, as in v1. *(The code reads them from env; waiting on the test key and price ids in `apps/server/.env`, TODO 6.1.)*

**Exit:** every scenario in the 06 test matrix has been replayed locally (Stripe CLI or signed test events), and the ledger reconciles after each one. *(Met with signed test events: `apps/server/test/billing.test.ts`, D-025. A replay against the real test account can follow 6.1.)*

---

## P7: Schedules and email ✅
- [x] `schedules` CRUD, pause/resume, run-now, `promptSelection`, hour + timezone, DST-safe `nextRunAt` (F-25)
- [x] Scheduler tick: atomic claim + advance, idempotent run creation, low-credit skip → email, auto-pause after 3 skips (F-27)
- [x] `send_email` job with idempotency + `email_log`. Drivers: `log` (default) and `resend` (used only when `RESEND_API_KEY` is set) (D-018)
- [x] Every template in [10](architecture/10-schedules-and-email.md) (F-26), with a plain-text fallback. Opt-out settings.
- [x] Fake-clock integration tests: daily, weekly, low credits, auto-pause after 3 skips, DST change. A short local soak with real timers.

**Exit:** the fake-clock suite passes, showing the correct runs, emails (in `email_log`), skips and auto-pause. *(Met: `apps/server/test/scheduler.test.ts`, `schedules.test.ts`, `emails.test.ts`, `scheduleTiming.test.ts`, and a passing `pnpm soak`; D-026.)*

---

## P8: Hardening ✅
- [x] Load test with fake providers (realistic latency and 429s): 3 concurrent runs of 150 prompts × 5 platforms. Each finishes in ≤ ~8 min; fairness holds. *(`pnpm loadtest`, real time: 10.0, 10.9 and 11.6 min. ≤ 8 min is impossible under Perplexity's 45 RPM and Claude's 50 RPM, whose floor is 10 min, so the bar is now within ~20% of that floor. Fair: 98% and 94% done when the first finished. One run alone: 3.5 min. D-027.)*
- [x] Spend caps verified (hitting a cap holds jobs, doesn't fail them) *(`apps/server/test/spendCaps.test.ts`)*
- [x] Security review against [07](architecture/07-auth-and-security.md) and [current-system-audit](reference/current-system-audit.md): CSP, cookies, rate limits, isolation, share DTO, error envelope, secret scanning *(D-027: no critical or high; fixes in place; gitleaks in CI)*
- [x] Backup script (`mongodump` of the v2 DB) and a tested restore into a scratch DB *(`pnpm db:backup`, ops/deployment.md)*
- [x] Alerts are logged at error level (5xx spike, job failures, reconciliation, spend cap) and also go to Sentry if `SENTRY_DSN` is set
- [x] Lighthouse on landing and report pages ≥ v1 *(landing 82/95/96/82 vs v1 62/76/96/82; report 66/100/96/45 with the intended `noindex`, 288 KB of JS vs v1's 525 KB bundle)*
- [x] Full Playwright e2e run locally, including billing in test mode *(4/4, with the e2e server's fake Stripe and real signed webhooks; a pass on real Stripe test mode follows TODO 6.1)*

**Exit:** no open critical or high findings; load test passed. *(Met, D-027. The medium follow-up, a Vercel-added secret header before trusting `X-Forwarded-For`, is done in 9.1, D-028.)*

---

## P9: Go live on the existing setup
Follow [ops/cutover.md](ops/cutover.md). No new accounts, services or DNS (D-018).
- [x] Go-live settings written: Render build/start commands + env vars (v2 DB name on the existing cluster), Vercel root `apps/web` + `/api` rewrite *([ops/go-live.md](ops/go-live.md). The `/api` proxy is now Vercel Routing Middleware adding `x-pv-edge-secret`; the API trusts `X-Forwarded-For` only with it (`EDGE_PROXY_SECRET`). Index sync is `pnpm admin sync-indexes`. Render build and start checked locally in production mode. D-028)*
- [ ] n8n workflows deactivated, exported (scrubbed) to `reference/n8n-export/` *(scrubber ready: `scripts/scrub-n8n-export.mjs`)*
- [ ] Old DB dumped (user-run)
- [ ] Settings applied to the existing Render service and Vercel project (user); smoke test passed
- [ ] `v1-final` tag; `backend/` + `frontend/` + `AUDIT.md` + `DOCUMENTATION.md` removed; `CLAUDE.md` updated
- [ ] Later (user): keys n8n held rotated, Hostinger VPS canceled, Supabase project deleted, old DB dropped

**Exit:** v2 serves the live site from `main`, n8n is gone, and the v1 code has been removed.
