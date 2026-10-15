# TODO: PromptVerse v2, stage by stage

This is the build order: do the steps top to bottom, and tick each one when it's done.
- **Scope (D-018):** this is a one-user beta. All work lands on `main` in `apps/` and `packages/`. There are no new accounts, no staging environment and no DNS changes. Testing is local, in CI, and with fake providers.
- **Owners:** `[Claude]` does the code and docs. The few `[You]` steps are approvals or settings on things you already have.
- **Detail:** each stage's sub-tasks and its **exit criteria** are in [CHECKLIST.md](CHECKLIST.md). A stage isn't finished until its exit criteria pass.

---

## Stage 0: Plan and docs
- [x] 0.1 [Claude] Write the `new-improvement/` docs and the root `CLAUDE.md`
- [x] 0.2 [You] Read CONTEXT, DECISIONS and CHECKLIST, and send changes
- [x] 0.3 [You] Confirm the production domain (Q-004). Resolved by D-018: keep the current domains.
- [x] 0.4 [You] Check that `N8N_API_KEY` is set on the **current** Render backend (v1 n8n endpoints are open without it)
- [x] 0.5 [Claude] Apply your review edits and log them in DECISIONS.md (approved with no edits, D-017; scope change D-018)

## Stage 1: Foundations
- [x] 1.1 [Claude] pnpm workspace on `main` next to v1 (`apps/*`, `packages/*`): TS/ESLint/Prettier/Vitest config, `.nvmrc`
- [x] 1.2 [Claude] `packages/shared`: enums, countries, languages, plans skeleton
- [x] 1.3 [Claude] `apps/server` skeleton: env validation, logger, optional Sentry, error envelope, `/api/health`, `/api/ready`, graceful shutdown
- [x] 1.4 [Claude] `apps/web` skeleton: Vite + TS + Tailwind theme port, router, QueryClient, typed API client, `/api` dev proxy
- [x] 1.5 [Claude] Local dev without Docker: an in-memory Mongo replica set script, `pnpm dev`, `.env.example` files
- [x] 1.6 [Claude] GitHub Actions CI (typecheck, lint, test, build)
- [x] 1.7 [Claude] Verify locally: CI green, `/api/ready` green, the web shell calls the API through `/api` with cookies (every CI step passes locally; GitHub Actions runs on the first push to `main`)

## Stage 2: Analysis engine and CLI
- [ ] 2.1 [You] Put your existing API keys in `apps/server/.env` (OpenAI, Perplexity, Gemini, DataForSEO, plus an Anthropic key for the Claude platform)
- [x] 2.2 [Claude] Engine core: types, cleaning (citation stripping), shared vendor extractor, matcher, cost table
- [x] 2.3 [Claude] ChatGPT adapter
- [x] 2.4 [Claude] Perplexity adapter (RPM-limited)
- [x] 2.5 [Claude] Gemini adapter
- [x] 2.6 [Claude] Claude adapter (web search, `pause_turn` loop, refusals)
- [x] 2.7 [Claude] Google AI Overviews adapter (DataForSEO, "no overview" = `no_answer`)
- [x] 2.8 [Claude] Recorded fixtures and unit tests for every edge case (domain-named brands, links, redirects, no AIO, refusals)
- [x] 2.9 [Claude] CLI: `ask`, `run` (resumable), `export` (XLSX)
- [ ] 2.10 [You] Approve the spend for the hand-check run (50 prompts × 5 platforms; Claude will quote the estimate first)
  - **Estimate (list prices, `prices.ts` 2026-10-14): about $12 for 250 checks; please approve a $20 cap.** Per check, including about $0.003 for vendor extraction: Claude Opus 5.5 ≈ $0.15 (about 65% of the total) · Gemini ≈ $0.04 (≈ $0.006 while under the 1,500 free grounded prompts a day) · ChatGPT ≈ $0.027 · Perplexity ≈ $0.008 · AI Overviews ≈ $0.005. Running AI Overviews a second time with async loading on, to settle Q-002, adds about $0.30.
- [ ] 2.11 [Claude] Run the hand-check, report agreement and the cost per check for each platform
- [ ] 2.12 [You] Decide Q-001 (Claude model / credit weights) and Q-002 (async AI Overviews)

## Stage 3: API core
- [x] 3.1 [Claude] Users, sessions, workspaces, memberships, with the workspace-isolation plugin
- [x] 3.2 [Claude] Register / login / logout / refresh with httpOnly cookies, password change
- [x] 3.3 [Claude] Google sign-in, email verification, password reset (emails go to the log driver)
- [x] 3.4 [Claude] Signup transaction: workspace + 50-credit bonus + pending referral
- [x] 3.5 [Claude] Middleware: validation, Origin check, rate limits, `trust proxy`
- [x] 3.6 [Claude] `/me`, `/plans`, `/meta`, with plan limits enforced (brands, prompts per run, platforms)
- [x] 3.7 [Claude] Brand analysis (summary, categories, aliases), brands CRUD, competitors
- [x] 3.8 [Claude] Prompt library (versioned edits, archive) and prompt generation
- [x] 3.9 [Claude] Cross-workspace security test suite (every id route returns 404 for other workspaces)

## Stage 4: Runs, queue and insights
- [x] 4.1 [Claude] Mongo job queue: claim, lease, fencing, retries, sweeper, graceful drain
- [x] 4.2 [Claude] Provider limiters, per-workspace fairness cap, daily spend caps
- [x] 4.3 [Claude] Credit ledger service (atomic reserve and refund by bucket)
- [x] 4.4 [Claude] `POST /runs/estimate` and `POST /runs` (one transaction, idempotency key)
- [x] 4.5 [Claude] Check worker → results, then idempotent finalize with aggregates and refunds
- [x] 4.6 [Claude] Cancel and delete runs; run list, detail (live progress) and results endpoints
- [x] 4.7 [Claude] `metrics.ts` (single definitions) with unit tests
- [x] 4.8 [Claude] Insights: overview, trend, competitors, sources, prompt history
- [x] 4.9 [Claude] Share links (revocable, public trimmed view) and XLSX export
- [x] 4.10 [Claude] Admin scripts: adjust credits, rerun failed checks, recompute aggregates, inspect run
- [x] 4.11 [Claude] Chaos tests: killed worker, lease expiry, 429 storm, two instances, double finalize

## Stage 5: Web app (same look, TypeScript)
- [x] 5.1 [Claude] App shell: layouts, sidebar (credits/plan), theme, 404, terms/privacy pages
- [x] 5.2 [Claude] Landing page with live pricing from `/plans`
- [x] 5.3 [Claude] Auth pages: login, register (`?ref=`), verify, forgot/reset, Google
- [x] 5.4 [Claude] Brands list and brand settings (edit, aliases, competitors, archive)
- [x] 5.5 [Claude] New-brand wizard: analyze → categories → prompts → run config + estimate + credit modals
- [x] 5.6 [Claude] Prompt library page with per-prompt history
- [x] 5.7 [Claude] Run progress page (live, cancel) and run lists
- [x] 5.8 [Claude] `ReportView`: tiles, charts, results matrix, answer/citation modals, filters, PDF, XLSX, share
- [x] 5.9 [Claude] Public shared report page (same `ReportView`, read-only)
- [x] 5.10 [Claude] Brand overview, competitors tab, sources page
- [x] 5.11 [Claude] Schedules UI (built against the contract; shows "available soon" until the Stage 7 API exists)
- [x] 5.12 [Claude] Billing, credits (ledger, referral, survey) and settings pages (checkout, top-up, portal and survey work once Stage 6 adds their endpoints)
- [x] 5.13 [Claude] Promo popup on run creation; redirects for old v1 URLs
- [x] 5.14 [Claude] Playwright smoke suite, run locally and in CI (fake providers): `pnpm e2e`
- [ ] 5.15 [You] Click through every row of `reference/feature-parity.md` on your local copy and tick it

## Stage 6: Billing (existing Stripe account, test mode)
- [ ] 6.1 [You] Put the existing Stripe **test** secret key and the test price ids (the ones v1 uses) in `apps/server/.env`
- [x] 6.2 [Claude] Checkout, top-up, portal and subscription-info endpoints (one customer per workspace)
- [x] 6.3 [Claude] Webhook handler at `/api/stripe/webhook`: signature check, event dedupe, the plan-credit reset/top-up/zero rules
- [x] 6.4 [Claude] Referral credit on email verification, survey credit in a transaction
- [x] 6.5 [Claude] Nightly ledger reconciliation and its alert (log, plus Sentry if set)
- [x] 6.6 [Claude] Replay every scenario locally with the Stripe CLI or signed test events (duplicates, out of order, failed payment, upgrade, downgrade, cancel) (signed test events in `apps/server/test/billing.test.ts`, D-025)
- [ ] 6.7 [You] Decide Q-003 (final prices, credits, brand limits per plan). Until then, v1 values are used.
- [ ] 6.8 [You] After 6.1: run `pnpm admin stripe-portal --yes` once and put the printed `bpc_…` id in `STRIPE_PORTAL_CONFIGURATION_ID` (optional; without it, upgrades get their extra plan credits at the next cycle)

## Stage 7: Schedules and email
- [x] 7.1 [Claude] Schedules API: CRUD, pause/resume, run now, prompt selection, hour + timezone
- [x] 7.2 [Claude] Scheduler tick: atomic claim, idempotent runs, low-credit skip, auto-pause after 3 skips
- [x] 7.3 [Claude] Email job + email log, with a `log` driver by default and a `resend` driver used only if `RESEND_API_KEY` is set
- [x] 7.4 [Claude] Email templates: verify, reset, welcome, schedule created/updated, run done, skipped, paused, low credits, payment failed (plus platforms dropped, D-026)
- [x] 7.5 [Claude] Fake-clock integration tests (daily, weekly, low-credit, auto-pause, DST) plus a short local soak (`apps/server/test/scheduler.test.ts`; `pnpm soak`, D-026)

## Stage 8: Hardening
- [x] 8.1 [Claude] Fake-provider load test (3 × 150 prompts × 5 platforms); confirm speed and fairness (`pnpm loadtest`: 10.0 / 10.9 / 11.6 min against a 10-min RPM floor, fair; one run 3.5 min. New provider concurrency and worker defaults, fair-share claims, D-027)
- [x] 8.2 [Claude] Verify spend caps hold jobs instead of failing them (`apps/server/test/spendCaps.test.ts`)
- [x] 8.3 [Claude] Security review against the audit list (cookies, CSP, rate limits, isolation, shares, errors, secrets) (no critical/high; 2 medium + 4 low fixed; one medium follow-up for go-live 9.1, the Vercel proxy header, D-027)
- [x] 8.4 [Claude] Backup script (`mongodump` of the v2 DB) and a tested restore into a scratch DB (`pnpm db:backup`, `test/backup.test.ts`)
- [x] 8.5 [Claude] Lighthouse check and the full Playwright e2e run (including test-mode billing) (landing 82 vs v1 62; report 66; e2e 4/4 with a fake Stripe. Real Stripe test mode after 6.1, D-027)

## Stage 9: Go live on the existing setup and remove n8n
- [x] 9.1 [Claude] Write the exact go-live settings: Render build/start commands and env vars (new v2 DB name on the existing cluster), Vercel root `apps/web` and `/api` rewrite. Include the D-027 follow-up: a Vercel-added secret header before the API trusts `X-Forwarded-For`, and a `pnpm db:backup dump` before switching ([ops/go-live.md](ops/go-live.md); Vercel middleware + `EDGE_PROXY_SECRET`; `pnpm admin sync-indexes`, D-028)
- [ ] 9.2 [You] In n8n: deactivate every workflow, then export them all to JSON
- [ ] 9.3 [Claude] Scrub secrets from the n8n export and save it to `reference/n8n-export/` (waits on 9.2; the scrubber is ready: `node scripts/scrub-n8n-export.mjs <folder>`)
- [ ] 9.4 [You] Dump the old `promptverse` DB for the record (Claude gives you the exact command: [go-live.md § 1](ops/go-live.md#1-dump-the-old-database-todo-94))
- [ ] 9.5 [You] Apply the 9.1 settings to the existing Render service and Vercel project
- [ ] 9.6 [You] + [Claude] Smoke test: sign up, run 5 × 5, report, share, test-mode top-up, a schedule
- [ ] 9.7 [Claude] Tag `v1-final`, delete `backend/` `frontend/` `AUDIT.md` `DOCUMENTATION.md`, update `CLAUDE.md` (only after 9.6 passes: until 9.5 the live services still build those folders)
- [ ] 9.8 [You] When ready: rotate the keys n8n held, cancel the Hostinger VPS, delete the Supabase project, drop the old DB
