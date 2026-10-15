# Decisions log

This log is append-only. To change a decision, add a new entry that supersedes the old one. Don't edit old entries.

Format: **ID: title** (date, status). Each entry gives the decision, why we made it, and the alternatives we rejected.

---

## D-001: Retire n8n completely (2026-10-13, accepted)
**Decision.** All business logic runs in our own backend. That covers:
- brand analysis
- prompt generation
- platform querying
- scoring
- competitor comparison
- scheduling
- emails

The n8n instance on Hostinger is shut down at cutover.

**Why.**
- n8n held half of the product's logic outside version control.
- It exposed open endpoints.
- It made the browser orchestrate paid work.
- It probably wrote to MongoDB directly.

A proven in-process pipeline already exists: the luna scripts.

## D-002: TypeScript monorepo on the same stack (2026-10-13, accepted)
**Decision.** A pnpm workspaces monorepo:
- `apps/server`: Express 5 + Mongoose 8
- `apps/web`: React 19 + Vite + Tailwind
- `packages/shared`: zod contract, enums, plans, metrics
- `packages/engine`: adapters, extraction, matching, CLI

TypeScript `strict` everywhere.

**Why.** The core pain is an untyped, drifting data contract between the API and the UI. Shared zod schemas fix that while keeping the team's stack and the current UI.

**Rejected.**
- Plain JS restructure: no compile-time contract.
- Next.js + Postgres: a full re-platform and UI rewrite for no product gain.

## D-003: Platforms and providers (2026-10-13, accepted)
| Platform id | Provider | Notes |
|---|---|---|
| `chatgpt` | OpenAI Responses API + `web_search` tool | Model `gpt-5.6-luna` (env). Proven in the luna scripts. |
| `perplexity` | Perplexity Sonar API | `sonar-pro` (env) |
| `gemini` | Gemini API with Google Search grounding | `gemini-2.5-flash` (env). Needs a paid key (free tier is 20 requests/day). |
| `claude` | Anthropic Messages API + `web_search_20260209` server tool | `claude-opus-5-5` (env `CLAUDE_MODEL`) |
| `google_aio` | DataForSEO SERP API (`ai_overview` item) | The user already has a DataForSEO account |

These ids are the only spellings. v1's `google_ai_overview`, `google_ai_overviews` and `googleAiOverviews` are gone.

## D-004: Hosting (2026-10-13, accepted)
**Decision.**
- Frontend on Vercel.
- Backend on a single **paid, always-on Render web service** that runs the API, the job worker and the scheduler in one process (`RUN_WORKER=true`). The worker can be split into a Render Background Worker later with an env flag.
- No Redis.
- MongoDB Atlas, at least **M10**. M0 and Flex throttle ops/sec, which hurts a polling queue.

**Why.** Cheapest setup with no new infrastructure. Render's free tier sleeps, which would break schedules.

**Consequence.** Render deploys overlap the old and new instance, so **two instances must be able to run at once**. Every claim, update and finalize is atomic.

## D-005: Workspace-ready data model (2026-10-13, accepted)
**Decision.** Every owned document carries `workspaceId`. Each user gets a personal workspace and an `owner` membership at signup. Plan, Stripe customer and credits belong to the **workspace**, not the user.

**Why.** The agency/white-label direction (PRD in `promptverse screens/`) needs multi-member ownership. Adding it later without this would mean migrating every collection.

**Deferred.** Invites, roles UI, white-label.

## D-006: Credit pricing (2026-10-13, accepted)
**Decision.**
- 1 credit = 1 check (1 prompt × 1 platform), for **manual and scheduled runs alike**.
- Credits are **reserved** when the run is created.
- Failed checks and canceled checks are **refunded** when the run finalizes.

**Why.**
- v1 charged 1 per prompt for manual runs but prompts × platforms for scheduled runs.
- v1 charged after the fact, using a count the browser supplied.

**Open.** Claude (Opus) costs far more per check than the others. P2 measures real cost per check. If the margin is bad, revisit with per-plan allowed platforms or per-platform weights (see Q-001).

## D-007: Email via Resend (2026-10-13, accepted)
**Decision.** All transactional email goes through Resend:
- verify
- reset
- welcome
- schedule created
- scheduled run done
- run skipped (low credits)
- low credits

Every send is a queued job with an idempotency key.

## D-008: API on `api.<domain>`, cookie auth (2026-10-13, accepted)
**Decision.**
- The API is served from a Render custom domain on the same site as the web app.
- Auth uses a short-lived access JWT plus a rotating refresh token, both in httpOnly, `Secure`, `SameSite=Lax` cookies.
- No tokens in localStorage.

**Why.** v1 used cross-site `SameSite=None` cookies plus a localStorage token to get around iOS Safari. Same-site cookies fix that properly.

**Rejected.** Proxying the API through a Vercel rewrite: it adds proxy limits, hides client IPs and adds a hop.

## D-009: MongoDB-backed job queue, built in-house (2026-10-13, accepted)
**Decision.** A small queue in a `jobs` collection:
- atomic `findOneAndUpdate` claims
- leases that are renewed while work runs
- fencing tokens (`leaseId`)
- backoff retries
- a sweeper

Rate limiting runs in-process per provider, and each workspace has a fairness cap.

**Why.** No Redis (D-004). The queue is about 300 lines we fully understand. Mongo transactions let a run reserve credits and create its jobs atomically.

**Rejected.**
- BullMQ: needs Redis.
- Agenda: maintenance uncertainty, and its semantics don't fit per-check fencing.

## D-010: One shared extractor and matcher for all platforms (2026-10-13, accepted)
**Decision.**
- After each answer, a single extractor (`gpt-5.4-mini`, strict json_schema `{vendors: string[]}`) lists the recommended companies in the order they appear.
- Matching is deterministic code: alias word-boundary regex on the answer text with citations stripped, plus domain matching via `tldts`.
- The brand and its competitors use the same functions.

**Why.** Results have to be comparable across platforms. The luna scripts showed this works. They also showed that citations must be stripped before checking for mentions.

## D-011: Competitor comparison is computed, not fetched (2026-10-13, accepted)
**Decision.** Competitor ranks, mentions and citations are computed for every tracked competitor on every check, from the same vendor list. There is no separate workflow call, and no limit of 3 competitors.

## D-012: Metric definitions (2026-10-13, accepted)
**Decision.** One set of definitions lives in `packages/shared/metrics.ts`:
- **Visibility** = mentioned ÷ answered.
- Pooled totals, never averages of per-platform percentages.
- The API returns `{num, den, rate}`.

See [05-metrics](architecture/05-metrics.md).

## D-013: Brand analysis without server-side fetching (2026-10-13, accepted)
**Decision.**
- The brand summary and categories come from one structured LLM call that uses OpenAI `web_search` to read the site.
- Favicons are a Google s2 URL built on the client.
- Our server never fetches user-supplied URLs.

**Why.** This removes the v1 SSRF entirely.

## D-014: Prompts are an immutable library per brand (2026-10-13, accepted)
**Decision.** Prompts live in a `prompts` collection per brand. Editing text archives the old prompt and creates a new one. Runs and schedules reference prompts by id and copy the text into each result.

**Why.**
- In v1, prompt arrays were copied into schedules.
- One edit path dropped categories.
- Trends couldn't tell whether a prompt had changed.

## D-015: Fresh database, no data migration (2026-10-13, accepted)
**Decision.** v2 uses a new Atlas database. v1 data is demo data: it is exported for the record, then dropped at cutover.

## D-016: Keep the current UI look (2026-10-13, accepted)
**Decision.** Port the existing Tailwind markup and charts into typed feature components. No visual redesign in v2. Kept as they are:
- the promo popup (shown 15 s after a run is created)
- dark mode
- PDF export

---

## D-017: Plan docs approved; production domain deferred (2026-10-14, accepted)
**Decision.** The user reviewed CONTEXT, DECISIONS and CHECKLIST and approved them with no edits. Stage 0 is closed.
- Production stays untouched until cutover. The `app.` / `api.promptverse.info` plan stands as the working assumption, but Q-004 moves from P1 to P9 and is confirmed at cutover (TODO 9.2/9.7).
- The user confirmed that `N8N_API_KEY` is set on the current Render backend, so the v1 n8n endpoints are not open (TODO 0.4).

---

## D-018: Single-user beta, main branch, no new accounts or infrastructure (2026-10-14, accepted)
**Context.** PromptVerse is a beta with one user (the owner). The goal of v2 is the code: finish the features, clean up the architecture and remove every n8n dependency. Setting up new hosting, staging or third-party accounts is out of scope.

**Decision.**
- **Branch:** all v2 work is committed to `main`, in `apps/` and `packages/`, next to v1. There is no `v2` branch. v1 keeps deploying from `backend/` and `frontend/` until go-live, so pushing v2 code doesn't change the live site.
- **No new accounts or environments:** no staging environment, no new Atlas cluster, no new Render or Vercel services, no DNS changes, no Resend or Sentry setup. Testing runs locally, in GitHub Actions CI, and with fake providers.
- **Reuse what exists:** the existing Atlas cluster (v2 uses a new database name on it, per D-015), the existing Render service and Vercel project, the existing Stripe account (test mode for development), and the existing provider API keys.
- **Go-live:** change the build settings of the existing Render service and Vercel project to build v2. The domains stay as they are.
- **API reached through the web origin** (supersedes the `api.<domain>` part of D-008): every server route is under `/api`. The web app calls `/api/...` on its own origin. Vercel rewrites `/api/*` to the Render service, and the Vite dev server proxies it locally. Auth cookies are first-party, host-only, `SameSite=Lax`, so `COOKIE_DOMAIN` and a custom API domain aren't needed. The Stripe webhook stays at the v1 path `/api/stripe/webhook` (on the Render URL), so the Stripe dashboard needs no change.
- **Email** (amends D-007): the email module has a `log` driver (default: writes the email to the log and `email_log`) and a `resend` driver that's used only when `RESEND_API_KEY` is set. Resend can be added later with no code changes.
- **Sentry is optional:** it's off when `SENTRY_DSN` is empty.
- **Hosting tiers** (amends D-004): no M10 requirement. The queue polls gently enough for the existing cluster tier. If the Render service is on the free tier, it sleeps when idle and schedules can run late. That's accepted for the beta.
- **Testing replaces staging:** the 72 h staging soak becomes fake-clock integration tests plus a local soak. The real-provider load test becomes a fake-provider load test. The real-provider hand-check (TODO 2.10) stays, because it measures engine accuracy, and still needs spend approval.
- **Q-004 resolved:** keep the current production domains.
- **Q-005 resolved:** the only user is the owner, so there are no paying customers to migrate.

**Still required (by design, not new accounts):** the two-instances-at-once safety rules (Render deploy overlap), workspace scoping, the credit ledger and all the other house rules.

**Rejected.**
- A `v2` branch with a separate staging stack. That means more accounts and infrastructure than a one-user beta needs.
- A custom `api.` subdomain. It's a production DNS change, and the Vercel rewrite gives first-party cookies without one. Its costs (an extra hop, and the client IP comes from `X-Forwarded-For`) are fine at beta scale.

---

## D-019: Stage 1 foundation choices (2026-10-14, accepted)
**Context.** Building Stage 1 (TODO 1.1–1.7) needed a few concrete choices the plan left open, and two small deviations from CHECKLIST P1.

**Decision.**
- **Internal packages ship as TypeScript source, no TS project references** (amends the P1 item "with project references"). `@pv/shared` exports `./src/index.ts`. Vite (web), Vitest and tsx (dev) read it directly; the server's production build bundles it with tsup (`apps/server/dist/main.js`, `@pv/*` bundled, `node_modules` external). Each package typechecks with `tsc --noEmit` against the shared `tsconfig.base.json`. The dependency rules are still enforced twice: pnpm only resolves declared dependencies, and ESLint `no-restricted-imports` blocks web → engine/server, shared → anything internal, engine → server/web, and `model.ts` imports outside the module's own `repo.ts`.
- **Env strictness by environment** (amends ops/env-vars.md "Req"): in **production** every integration secret is required and `FAKE_PROVIDERS` must be false, or the server refuses to boot. In **development and test** only `NODE_ENV` and `MONGODB_URI` are required, and `APP_URL` defaults to `http://localhost:5173`; a missing key only matters when the feature that uses it runs. This keeps `pnpm dev` working with no `.env` at all.
- **Tool versions:** pnpm 11 (build scripts opt-in via `allowBuilds`), Node 22 (`.nvmrc`), TypeScript 6.0 (typescript-eslint doesn't support TS 7 yet), ESLint 9 flat config with type-aware rules, Prettier 3, Vitest 3.2 (`projects`), Vite 7, Tailwind 3, React 19, react-router 7, TanStack Query 5, Express 5, Mongoose 8, zod 4, pino 10.
- **Languages are stored as ISO 639-1 codes** (`en`, `fr`, …), countries as ISO 3166-1 alpha-2. v1 stored language names.
- **Local DB:** `pnpm dev` starts a `mongodb-memory-server` replica set on port 27027 unless `MONGODB_URI` is set; tests start their own one per run.
- **`apps/web/vercel.json`** carries the `/api` rewrite with a `<existing-render-host>` placeholder. It isn't used until go-live; TODO 9.1 fills in the real host.

**Rejected.**
- TS project references with `composite` builds: they need declaration emit and a build step before every typecheck, for no benefit at this size.
- Requiring every secret in development: blocks `pnpm dev` and CI on keys that Stage 1 doesn't use.

---

## D-020: Perplexity moves to the Agent API (2026-10-14, accepted)
**Context.** Perplexity ended Sonar Chat Completions on **2026-09-27** (docs.perplexity.ai, sonar-pro page). Sync calls are being rerouted to the Agent API, and Perplexity maps Sonar Pro to the Agent API `fast` preset. The plan in 03 and D-003 still assumed `POST /chat/completions` with `sonar-pro`.

**Decision.**
- The `perplexity` adapter calls `POST https://api.perplexity.ai/v1/agent` with `{ preset, input, tools: [{ type: 'web_search', user_location }] }`. The response has the Responses API shape: an `output[]` holding `search_results` (with numeric `id`s) and a `message`, plus `usage.cost.total_cost`.
- Citation markers are `[web:<id>]` and refer to the search result `id`. As before, we keep only the sources the answer cites, and keep all of them if there are no markers.
- When Perplexity reports the cost in `usage.cost`, that number is the check's cost. The price table is only the fallback.
- The parser still reads the legacy Sonar shape (`choices`, positional `[n]`), so v1 and luna answers stay readable.
- Env: `PERPLEXITY_MODEL` (`sonar-pro`) is replaced by `PERPLEXITY_PRESET` (`fast`).

**Consequences to watch.**
- The `fast` preset currently runs `openai/gpt-5.6-luna`, the same model as our ChatGPT platform. The answers still differ, because Perplexity runs its own search and prompting, but the two platforms are now less independent. The 2.11 hand-check will show how far they overlap.
- The docs don't show an example of `user_location` on the Agent API `web_search` tool (it is only listed as `tools[].user_location`). 2.11 confirms that it's accepted and actually localises results. The Agent API allows about 1 request/s at tier 0, so the default limit is 45 RPM with a concurrency of 3.

**Rejected.** Staying on `/chat/completions` and relying on the rerouting: it's being rolled out gradually per model, it's undocumented, and async requests are already gone.

---

## D-021: Stage 2 engine choices (2026-10-14, accepted)
**Context.** Building `packages/engine` (TODO 2.2–2.9) needed some choices that 03 left open, plus a few deviations found while testing.

**Decision.**
- **Matcher regex fix.** The 03 sketch's `esc()` escaped `-`, and a `u`-flag regex rejects that: any hyphenated alias (`Hewlett-Packard`) threw an error. `esc()` no longer escapes `-`. Matching also NFKC-folds text and quotes (`SS＆C`, `Lowe’s`), and a space in an alias matches any whitespace run.
- **Cited** means the citation's registrable domain (tldts, private suffixes on) equals the brand's. So `docs.brand.com` counts, and `brand.com.evil.io` and `a.blogspot.com` vs `b.blogspot.com` don't.
- **Retries belong to the caller.** The OpenAI and Anthropic SDKs run with `maxRetries: 0`. Adapters throw `ProviderError` by kind, and `retry.ts` holds the 04 policy, shared by the CLI now and the queue in P4. The vendor extractor keeps its own 2 retries (then `ExtractError`, code `extract_failed`).
- **Claude refusal fallback is on by default** (`fallbacks: "default"` with the `server-side-fallback-2026-07-01` beta; env `CLAUDE_REFUSAL_FALLBACK=true`). The model that actually answered is recorded. Set it to `false` to measure Opus 5.5 alone.
- **Gemini citations.** The domain comes from the chunk title when it's a domain. Otherwise one cached HEAD request (redirects not followed, 5 s timeout) resolves the Google redirect. It only ever fetches `vertexaisearch.cloud.google.com` URLs that Google returned, never a user-supplied URL (D-013 still holds).
- **DataForSEO locations.** A country's location code is `2000 + ISO 3166-1 numeric`, a static table covering all 38 countries. A city is looked up once per country through the free `serp/google/locations/{cc}` list and cached. `zh` and `pt` map to region codes.
- **AI Overviews.** The live check (US, "best wealth management software for independent advisors") showed that with `load_async_ai_overview: false`, Google *did* show an overview, but DataForSEO returned only a stub (`asynchronous_ai_overview: true`, no text). We store that as `no_answer` with `usage.aioNotLoaded = 1`, so the under-count is measurable (Q-002).
- **CLI output layout.** A run directory holds `run.json` (spec, `engineVersion`, `pricesVersion`), `results.jsonl` (append-only, newest line per check wins) and `raw/<platform>/*.json`. A re-run skips `ok`/`no_answer` checks and retries failed ones. A `quota` error stops that provider for the rest of the run instead of waiting 15 minutes. `export` writes the luna sheet layout with an added Platform column.
- **Metrics.** `packages/shared/src/metrics.ts` now holds `ratio`, `visibility`, `citedRate` and `averageRank` (answered checks only), so the CLI export doesn't define its own. TODO 4.7 completes the module.
- **Prices** are in `prices.ts`, `PRICES_VERSION = 2026-10-14`. A provider-reported cost (Perplexity `usage.cost`, DataForSEO `cost`) always wins over the table.
- **Fixtures.** Where real responses exist (luna ChatGPT and Perplexity answers, one live DataForSEO SERP), the fixtures are built from them. The Gemini, Claude and loaded-AIO fixtures follow the documented API shapes and are marked `synthetic` in `meta`. `pnpm engine ask --record` re-records any of them once keys are set (2.11).

---

## D-022: Stage 3 API core choices (2026-10-14, accepted)
**Context.** Building the API core (TODO 3.1–3.9) needed choices that 07 and 08 left open, plus a few small deviations.

**Decision.**
- **Libraries:** `bcryptjs` (pure JS, so no native build under pnpm's opt-in build scripts), cost 12 (the test suite uses 4); `jose` for the HS256 access JWT; `express-rate-limit` 8; `google-auth-library` for ID tokens.
- **Sessions are checked on every request** (stronger than 07's stateless access token): `requireAuth` confirms the session is live and the user is still a member of the token's workspace, cached 60 s per instance. So logout, password change and reuse detection take effect at once on the same instance and within 60 s elsewhere, not after the 15-minute token lifetime. `sessions` rows carry `workspaceId`, so refresh re-issues for the same workspace.
- **Refresh reuse grace (amends 07):** a refresh token replaced less than 30 s ago gets a plain 401 instead of revoking its family. Two tabs refreshing at the same moment send the same token, and the browser already holds the winner's cookies. Older reuse revokes the family, as 07 says. Rotation is an atomic claim inside a transaction, so two instances can't both rotate one token.
- **Origin check:** a state-changing request with a missing `Origin` is refused (403), the same as a wrong one. A body that isn't JSON gets 415.
- **Login lockout:** in memory per instance. Only failures count; 10 within 15 min lock the email for 15 min, each further lockout doubles, capped at 24 h; a successful login clears it. `/auth/resend-verification` is limited per user with the same 3/hour rule as forgot-password.
- **Costly endpoints:** `/brands/analyze` and `/prompts/generate` each have their own 30/hour per-workspace limiter (`POST /runs` gets a third in Stage 4).
- **New error code `UPSTREAM_UNAVAILABLE` (503):** an AI provider failed or isn't configured, or Google sign-in isn't configured. Like every 5xx, the client gets the generic message; the code tells the UI it's worth retrying.
- **Emails until Stage 7 (amends D-018):** auth emails are sent through a `Mailer` with the `log` driver, after the transaction and in the background (a failed send never fails the request). Outside production the whole email is logged, so local verify/reset links can be copied from the console. In production, bodies that contain a one-time link are **not** logged, because a reset link in the logs is a credential; set `RESEND_API_KEY` (Stage 7.3) before relying on email verification or password reset in production.
- **Registration says when an email is taken** (409 `CONFLICT`). Login errors stay generic (07); hiding existence at signup isn't worth the extra email flow for a beta.
- **Google linking:** a Google sign-in links to an existing account with the same email only if that account has no Google id yet; a second Google account for one email is refused (409). Linking, the verify link and a completed password reset all mark the email verified through one function, where Stage 6.4 adds the referral credit.
- **Brand limit under concurrency:** brand creation runs in a transaction that first bumps `workspaces.lockVersion`, so concurrent creates conflict and retry instead of both taking the last slot. Same-domain duplicates are caught by the partial unique index (`archivedAt: {$type: 'null'}`; partial indexes don't accept `archivedAt: null`).
- **Websites and domains:** the server normalises what the user typed to `https://host/path` and keeps the registrable domain (tldts). IPs, `localhost` and non-http(s) schemes are rejected. Nothing is fetched (D-013). Competitor domains get the same treatment, can't equal the brand's, and keep their ids when the client sends them back.
- **Archived brands** stay readable (`GET /brands/:id` returns them with `archivedAt`, and their prompts can still be listed) but every change to them, or to their prompts, is a 404. Archiving frees the plan slot and the domain.
- **Prompt edits (D-014):** a text change archives the prompt and inserts its replacement in one transaction; the atomic archive is the claim, so concurrent edits can't fork it. A category-only change is made in place, because category isn't part of a prompt's identity. Bulk add skips exact repeats (ignoring case) of active prompts.
- **Brand analysis and prompt generation live in the engine** (`packages/engine/src/brandAi.ts`), on `OPENAI_UTILITY_MODEL` (`gpt-5.4-mini`), strict JSON schemas. Analysis uses `web_search`; generation doesn't. Drafts that name the brand, its aliases or its domain are dropped, and the location is "city, country" for a local scope (the v1 `localSearchCity` bug). `FAKE_PROVIDERS` has a deterministic fake.
- **Plan limits:** `workspaces/limits.ts` holds the brand-slot, platform and prompts-per-run checks. Stage 3 applies them to brand creation, brand default platforms and prompt generation; `POST /runs` (4.4) reuses them.
- **Groundwork for later stages:** the `schedules` model is defined now (archiving pauses schedules); `credits/service.applyCreditChange` is the single atomic `$inc` + ledger row that 4.3 builds reservations and refunds on; `GET /brands` already returns `promptCount`, `activeSchedules` and `latestRun` (null until runs exist).
- **Route guard:** protected routes are mounted behind one list of prefixes (`PROTECTED_PREFIXES` in `http/app.ts`). A test reads every route from the source and fails if one is neither on the reviewed public list nor answers 401 without a session, and the isolation suite fails if an `:id` route has no cross-workspace case.

**Rejected.**
- Native `bcrypt`: needs a build script approval and a compiler on Render for no gain at this volume.
- A stateless access token with no session check: logout and password change would leave other copies valid for up to 15 minutes.

---

## D-023: Stage 4 runs, queue and insights choices (2026-10-14, accepted)
**Context.** Building runs, the job queue and insights (TODO 4.1–4.11) needed choices that 04, 05 and 08 left open, and the chaos tests found one engine bug.

**Decision.**
- **Layout.** The queue is `apps/server/src/jobs/`: `repo.ts` (claims, leases, fenced state changes), `worker.ts` (claim loop, lease renewal, drain), `sweeper.ts`, `providerGates.ts`, `handlers/check.ts`, `handlers/finalizeRun.ts`. There is no separate `queue.ts`. Runs, results, shares, insights and `provider_spend` are modules under `src/modules/`.
- **Fencing is on the result too (stronger than 04).** When a lease takes a check it writes its `leaseId` onto the `run_results` doc, and the outcome is written only where `status: 'running'` and `leaseId` still match. A worker that lost its lease can't store anything, even if it re-checked the job a moment before. 04's double-execution case (two workers, one check) is now "the provider is paid twice, the newest lease's answer is stored once". Jobs carry a `runId`, so cancel and delete find a run's jobs.
- **Worker size:** new env `WORKER_CONCURRENCY` (default 24): jobs one instance runs at once. Per-provider concurrency and RPM still apply on top, and the per-workspace cap stays `MAX_INFLIGHT_PER_WORKSPACE`.
- **AIMD fix (engine).** A burst of 429s halved the rate once per error, so 12 in-flight requests failing together took OpenAI from 400 RPM to 1 RPM. `RateLimiter.onRateLimited` now halves at most once per `RATE_DECREASE_COOLDOWN_MS` (2 s); the CLI runner gets the same fix.
- **Unexpected errors** (a bug, a DB blip) retry with the `transient` backoff; on the last attempt the job fails and its check becomes `failed` with code `internal` and is refunded. The sweeper does the same for a job whose lease expires on its last attempt.
- **Finalize waits for open checks.** If any check is still `pending` or `running` (a canceled run's in-flight checks), finalize re-queues itself in 10 s without using an attempt. The finalize job's dedupe key revives a finished job when it's needed again, so the last check's enqueue is never lost.
- **Final status:** `completed` when nothing failed (a run of only `no_answer` checks is completed), `partial` when something failed and at least one check is `ok`, otherwise `failed`. A canceled run stays `canceled`.
- **Refunds and generations.** Finalize refunds `reserved − charged − already refunded` (charged = `ok` + `no_answer`), purchased bucket first, never more than a bucket gave. An admin rerun of failed checks reserves again as a new run generation; its ledger rows use `run/<runId>:<generation>`, so every row keeps a unique key and each generation is finalized once (`runs.generation`, `runs.finalizedGen`).
- **Daily spend caps** (`PROVIDER_DAILY_CAP_USD` overrides): OpenAI $50, Perplexity $25, Gemini $25, Anthropic $75, DataForSEO $15, per UTC day, shared through `provider_spend`. The vendor extractor runs on OpenAI for every check, so when OpenAI is over its cap every provider's checks wait. Hitting a cap logs an error (and Sentry if set) once a day; jobs wait, they never fail.
- **`POST /runs`:** the `Idempotency-Key` header is required (8–128 characters); a replay returns 200 with the same run. A platform the server has no key for is refused with 503 `UPSTREAM_UNAVAILABLE` before any credit is reserved. Archived or unknown prompt ids are 400. The run stores `promptSetHash` and `platformsHash` (sha1 of the sorted ids) for trend comparability, and `engineVersion` at creation; each result also stamps the `engineVersion` that produced it.
- **Results** store `suggested` (vendors matching no tracked company) so suggested competitors are recomputable. A failed check's provider text stays internal; the API returns a fixed message per error code (`CHECK_ERROR_MESSAGES`).
- **Cancel** cancels queued jobs and the checks of every canceled job, even one a dead worker left `running`. Canceling a canceled run is a no-op; a finished run gives 409 `CONFLICT`. **Delete** works only on a final, finalized run (409 `RUN_NOT_FINAL` otherwise) and removes the run, results, raw payloads, shares and jobs in one transaction.
- **Metrics:** average rank is `{ value, count }` everywhere; `visibilityDelta` compares two runs over shared prompts and platforms. `GET /brands` `latestRun.visibility` is null until that run finishes.
- **Insights:** `from`/`to` default to the last 90 days. The trend skips runs that didn't include the requested `?platform`. Sources return the top 100 domains with up to 3 sample URLs and prompts each. Competitor insights default to the newest completed or partial run; a run that isn't final is 409 `RUN_NOT_FINAL`.
- **Shares (amends 07):** only final runs can be shared. The public DTO also carries each check's citations (`url`, `domain`, `title`) and competitor results by name, so the read-only report can show the citation modal and the competitor matrix. Still no ids, costs, models, raw payloads or workspace data. Unknown, revoked and expired links are the same 404. Views are counted.
- **XLSX export** is built on the server from the stored aggregates, so it matches the report. It has no costs or models (it's meant for clients); the CLI export keeps its cost columns. A run that isn't final is 409.
- **Admin scripts:** `pnpm admin inspect-run | recompute-aggregates | rerun-failed | adjust-credits` (`apps/server/scripts/admin.ts`, logic in `src/admin/`). Commands that write do nothing without `--yes`. Production use is user-run.
- **Deferred:** the scheduled-run email and `schedules.lastRunId` (Stage 7), and the nightly ledger reconciliation job (6.5; `ledgerMatchesBalance()` exists and the tests use it).

**Rejected.**
- Fencing only on `status` (04's sketch): a stalled worker that re-checked its lease just before writing could still overwrite the answer of the lease that replaced it.
- Charging nothing for an admin rerun: it would need a second refund rule, and the operator can always grant credits with `adjust-credits`.

---

## D-024: Stage 5 web app choices (2026-10-14, accepted)
**Context.** Porting the v1 UI to `apps/web` (TODO 5.1–5.14) needed choices that 09 left open, a few small server additions, and contracts for endpoints that later stages build.

**Decision.**
- **Contracts ahead of the endpoints.** `packages/shared/src/api/schedules.ts` (Stage 7) and `api/billing.ts` (Stage 6: checkout, top-up, portal, subscription, ledger, referrals, survey with the six v1 questions as `SURVEY_QUESTIONS` / `surveyAnswersSchema`) are defined now so the pages are typed. A schedule exposes `creditsPerRun`. `LEDGER_REASONS` moved to shared; the server model imports it. Until a stage ships its endpoints, the page catches the 404 and says the feature is coming soon, while still rendering what it can (plans from `/plans`, the form, the balance).
- **Small server additions** for pages that only read: `GET /credits/ledger` (cursor, newest first, `runId` on run rows), `GET /referrals` (counts only, link built from `APP_URL`), and `POST /auth/logout-all` for "sign out everywhere" (revokes every session of the user, this one too). Tests: `apps/server/test/credits.test.ts`; the route-inventory test lists `logout-all` as inline-protected.
- **Routes.** As in 09, plus `/app/brands/:brandId/competitors` as its own route (the Overview · Competitors tabs are links). Brand pages use `BrandLayout` (v1 BrandSidebar, without the "Soon" items, F-46) and get the brand through `useBrandOutlet()`. Old v1 paths (`/reports/:id`, `/shared/:token`, `/brands/:id/*`, `/profile`, `/buy-credits`, `/earn-credits`, `/dashboard`) redirect on the client. Pages are lazy-loaded; a chunk that fails after a deploy shows "A new version is available".
- **Data layer.** One hook file per module in `src/lib/api/`. `useRun` polls every 2 s until final and then invalidates `me`, runs, insights, brands and the cached result rows. Run lists poll every 4 s while any listed run is live. `POST /runs` and run-now send a fresh `Idempotency-Key` per click. Run creation emits `runCreated` on a small in-app event bus (`lib/events.ts`); the promo popup listens, so there's no sessionStorage polling (sessionStorage only remembers "already shown this session").
- **Shared run form.** `features/runs/RunConfigForm` (prompts, platforms locked outside the plan, location, server estimate, low and insufficient credit modals) is used by the wizard and `/runs/new`; its pickers are reused by the schedule form. The low-credits modal shows when the run would leave 10 credits or fewer (v1's threshold), and offers "Continue anyway".
- **One `ReportView`** for owners and public shares, fed by a view model (`features/reports/viewModel.ts`: `fromRun(run, results)` and `fromPublicReport`). The owner view filters on the server (`/runs/:id/results` params) and loads every page so the prompt × platform matrix is complete; the read-only share filters its inline checks the same way. The share page adds a `noindex` meta tag while mounted. The PDF is jsPDF only, imported on click, says "PromptVerse", and states how many result rows it includes.
- **Wizard resume.** The brand is created at the end of step 1 and its id is kept in `?brandId=`. Opening `/app/brands/new?brandId=X` resumes at step 2 (no prompts) or step 3 (prompts saved). Generated drafts that haven't been saved yet are not kept across reloads.
- **Copy.** The landing page drops claims v2 can't back up: v1's invented usage numbers, ratings, "14-day trial", "30-day money-back", "instant alerts" and "sentiment analysis". Terms and Privacy are short beta pages with no invented legal promises.
- **Libraries.** recharts 3, react-hook-form 7 with `@hookform/resolvers` 5 (zod 4), react-hot-toast, `@react-oauth/google` (only mounted when `VITE_GOOGLE_CLIENT_ID` is set), `@vercel/analytics`, jsPDF 4. Testing Library + jsdom for component tests: a test opts in with `// @vitest-environment jsdom`. The build splits `react` and `query` vendor chunks.
- **E2E.** `pnpm e2e` (`e2e/playwright.config.ts`) starts its own in-memory replica set and the API with `FAKE_PROVIDERS=true` on port 4100, plus Vite on 5180, so it can run next to `pnpm dev`. The smoke test covers signup (sidebar shows the 50 bonus credits at once) → wizard → run → report and answer modal → share link opened signed out, plus v1 redirects, the 404 page and pricing from `/plans`. CI has a separate `e2e` job.

**Rejected.**
- Waiting for Stages 6–7 before building those pages: the UI is the same either way, and the shared contracts keep both sides honest.
- Two report components (owner and shared), as in v1: they drifted.

---

## D-025: Stage 6 billing choices (2026-10-15, accepted)
**Context.** Building billing (TODO 6.2–6.6) needed choices that 06 left open, and replaying the 06 test matrix showed a few rules that had to be stated more precisely.

**Decision.**
- **SDK and API version.** `stripe@22.6.2` (23.0.0 was under two weeks old), with the API version pinned to the one it ships with, `2026-08-26.dahlia` (`STRIPE_API_VERSION` in `billing/gateway.ts`). Handlers use only an event's id, type and object id and re-fetch the object, so the existing endpoint's own API version (whatever v1 created it with) doesn't matter and the Stripe dashboard needs no change.
- **One port to Stripe.** `BillingGateway` (`modules/billing/gateway.ts`) is the only code that calls the SDK. It returns small snapshots, reads the invoice's subscription through one helper (`parent.subscription_details`, or the legacy field) and the period from the subscription item (or the legacy fields). Tests use an in-memory `FakeStripe` and sign events with the SDK's own `generateTestHeaderString`, so the real signature check runs.
- **Events handled.** `checkout.session.completed` and `.async_payment_succeeded`; `invoice.paid` **and `invoice.payment_succeeded`** (v1's endpoint subscribes to the latter; both mean the same paid invoice, and the invoice-keyed ledger rows make the second a no-op); `invoice.payment_failed`; `customer.subscription.created/updated/deleted/paused/resumed`. Anything else gets 200 and no row. The existing endpoint must send at least: `checkout.session.completed`, `invoice.paid` or `invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted` (checked at go-live, 9.1).
- **Dedupe (amends 06 step 2):** while another delivery holds a fresh claim (< 5 min), the answer is **409**, not 200, so Stripe retries later and an event isn't lost if that instance dies. A failed or stale claim is taken over (`attempts + 1`).
- **Plan credits follow the billing period (amends the 06 table).** `workspaces.planCredits = {periodStart, allowance}` records the last reset. A paid invoice whose re-fetched subscription is live:
  - opens a **newer period** than the last reset → reset (`plan_reset` −balance, `plan_grant` +allowance);
  - same period with a **higher allowance** (an upgrade's proration invoice) → top up to the new allowance;
  - otherwise nothing.
  `billing_reason` is only logged. So a downgrade schedule's period-end invoice resets whatever reason Stripe gives it, and a late, replayed or extra invoice in the same period can't refill spent credits. The ledger rows stay keyed by invoice id.
- **The end of a subscription is read from its re-fetched status** (`canceled`, `incomplete_expired`) on any subscription event, not only `.deleted` (amends "subscription.updated never touches credits"): tier `free`, status `canceled`, plan credits → 0 once (`stripe_sub_end/<sub_id>`), purchased kept. Events for a subscription other than the workspace's current one change nothing once it has ended; a second live subscription is adopted and alerted (log + Sentry).
- **Status mapping** (`mapStripeStatus`): active/trialing → `active`; past_due/unpaid/paused → `past_due`; canceled/incomplete_expired → `canceled`; incomplete and anything new → `none` (not applied yet).
- **Unknown objects.** Events for customers we don't know (v1 shares the Stripe account) are acknowledged and ignored. A subscription or top-up whose price isn't in env fails the event (500), so Stripe keeps retrying it until the env is fixed, instead of guessing a tier.
- **Customers.** Created at the first checkout or top-up with the Stripe idempotency key `customer:<workspaceId>`, stored with a set-if-unset update; the stored id wins a race.
- **Who can buy.** Checkout and top-up need the workspace `owner` and a verified email (07: 403 `EMAIL_NOT_VERIFIED`); the portal needs the owner and an existing customer (409 `CONFLICT` otherwise). Without `STRIPE_SECRET_KEY` (or the price, or the webhook secret) the endpoints answer 503 `UPSTREAM_UNAVAILABLE`. Stripe returns to `/app/billing?checkout|topup=success&session_id=…` or `=cancel`, which the Stage 5 page already reads.
- **Portal settings** as 06 asks (upgrades at once with `always_invoice`, downgrades scheduled at period end, cancel at period end, card and invoices) come from `pnpm admin stripe-portal --yes`, which creates the configuration in the Stripe account and prints the `bpc_…` id for the new optional env `STRIPE_PORTAL_CONFIGURATION_ID`. Unset, the account's default portal is used; with its default `create_prorations`, an upgrade's extra credits wait until the next cycle, because no invoice is paid mid-cycle.
- **Failed payment.** Status → `past_due` only while the failed invoice is still open, so a late failure event after a successful retry changes nothing. The owners get a plain-text `payment_failed` email through the mailer (log driver; Stage 7.4 adds the HTML version and 7.3 the email job).
- **Referrals (6.4).** The first verification (link, reset or Google linking) marks the email verified and settles the pending referral in one transaction (`referrals/service.settleReferral`). A Google sign-up with `?ref=` is verified already, so it's settled inside the signup transaction. A referrer workspace the user belongs to is a self-referral: `rejected`, no credit.
- **Survey (6.4).** `surveys` is keyed by user (unique `userId`, no workspace-scope plugin, like `sessions`); the insert and the +50 grant are one transaction. `POST /survey` answers 201, a second one 409 `CONFLICT`.
- **Reconciliation (6.5).** A `reconcile_ledger` job, enqueued by every sweep with the dedupe key `reconcile_ledger:<UTC date>` (new `jobsRepo.enqueueOnce`, which never revives a finished job, unlike finalize's key), due at 03:00 UTC. It checks 500 workspaces per snapshot transaction, so a credit change committing meanwhile can't look like a mismatch. Each mismatch is logged at error level and sent to Sentry if set, never fixed. `pnpm admin reconcile` runs it on demand.
- **Top-up refunds** stay manual: refund in the Stripe dashboard, then `pnpm admin adjust-credits --bucket purchased --delta -<n>`. `charge.refunded` isn't handled.
- **6.6 replay.** The Stripe CLI isn't installed on the dev machine, so the matrix was replayed with signed test events (`apps/server/test/billing.test.ts`), which 06 allows. Once 6.1's keys are in `.env`, `stripe listen --forward-to localhost:4000/api/stripe/webhook` replays against the real test account (ops/deployment.md).

**Rejected.**
- Granting or resetting plan credits by `billing_reason` alone (06's table): a schedule's period-end invoice may be labelled `subscription_update`, which would skip the downgrade's reset, and any extra same-period invoice would refill credits.
- Answering 200 to a delivery while another instance processes the same event: if that instance dies, Stripe never redelivers.

---

## D-026: Stage 7 schedules and email choices (2026-10-15, accepted)
**Context.** Building schedules, the scheduler tick and the email job (TODO 7.1–7.5) needed choices that 10 left open, and one contract bug turned up on the way.

**Decision.**
- **Slot math** is `luxon` 3.7.2 (`modules/schedules/timing.ts`). The local slot is built from its calendar fields in the zone, so it stays at the same local hour across DST. A slot in a spring-forward gap runs at the first valid time after it (02:00 → 03:00); a slot in the repeated fall-back hour runs once, at its first occurrence. `nextRunAt` is always the first slot strictly after now.
- **Claims survive a crash (stronger than 10's sketch).** The claim advances `nextRunAt` *and* records `inFlight: {slot, until}` (5 minutes) in one conditional update, matched on the old `nextRunAt`. Finishing the slot (run created, or skipped) clears `inFlight` in an update fenced on that slot. A claim whose `until` passes is taken over by the next tick on any instance and the same slot is processed again; the run's key `schedule:<id>:<slotISO>`, the per-slot email keys and the fenced updates make that safe. 10's sketch lost the slot if the instance died between claim and run.
- **One run path.** `runs.startRun` is the single place a run is created (manual `POST /runs`, run-now, scheduled), with the same transaction, ledger rows and idempotency. Run-now is a `manual` run with `scheduleId` set, becomes the schedule's last run, and isn't a slot. A scheduled run has `createdBy: null`. `schedules.lastRunId` is set when the run is **created** (not at finalize), so the card links to a live run.
- **What a slot runs.** `all_active` = the brand's active prompts at that moment; `fixed` = its ids minus archived ones (oldest first). Both are capped at the plan's prompts per run. Platforms outside the plan are dropped and the owners emailed once per platform set (`schedule_platforms_dropped`, new template). A platform the server has no key for is dropped too, with an error log and Sentry, not an email. No prompts → skip `no_prompts`; no platforms → skip `no_platforms`. Only credit skips count toward the auto-pause; the others are shown on the card (`lastSkip`).
- **Credit skip order.** The skip and pause emails are queued before the slot is marked done, then the fenced update increments `consecutiveSkips`; at 3 the schedule pauses (`insufficient_credits`, `nextRunAt: null`). A retried slot queues nothing new (keys) and counts once (fence). Resume recomputes `nextRunAt` from now and clears the streak.
- **API rules.** A PATCH is merged with the stored schedule and checked as a whole with `scheduleConfigSchema`; unused day fields are cleared (`weekday` unless weekly, `dayOfMonth` unless monthly, `city` unless local). A frequency outside the plan (free: weekly and monthly, 06) is 400 on create, PATCH and resume. Up to 10 schedules per brand (409). An archived brand's schedules are readable; every change is 404 (as D-022 for brands). `schedule_updated` is sent when timing, platforms or prompt selection change, not for a label or location change.
- **Contract fix.** `patchScheduleBodySchema` was `.partial()` of fields with defaults, and zod 4 applies defaults inside optional fields, so a `{hour: 9}` PATCH also sent `label: ''`, `weekday: null`, `dayOfMonth: null` and `city: null`. The patch schema is now built from fields without defaults.
- **Email job.** `emails/outbox.ts` is the only way to send: it writes `email_log` (`queued`) and enqueues `send_email` with `jobsRepo.enqueueOnce` on `email:<idempotencyKey>`, so a key is queued once ever. The handler skips keys already `sent`, checks opt-outs (`suppressed`), re-checks its lease right before the send, sends with the key as Resend's `Idempotency-Key`, and records `sent` / `failed`. Transient failures (network, 429, 409, 5xx) retry on the queue's transient backoff, up to 6 attempts; other 4xx fail at once. Once a job finishes, its `payload.data` is replaced by `{redacted: true}`, so verify and reset links don't stay in `jobs` for the 14-day TTL; `email_log` never holds a body.
- **Drivers.** `EMAIL_DRIVER` is now optional (amends env-vars.md): unset means Resend when `RESEND_API_KEY` is set, else `log`; `log` forces logging. Resend is one `fetch` POST, no SDK. The log driver keeps D-022's rule (no bodies with one-time links in production logs).
- **Templates** are typed TypeScript (`emails/templates.ts`, `layout.ts`) instead of React Email (amends 10): one block list renders both the HTML (inline styles, every value escaped) and the plain text, so they can't drift, and the server needs no React. Dates show in the schedule's own zone.
- **Recipients and keys.** Auth emails go to the user (`verify:<tokenId>`, `reset:<tokenId>`; `authTokensRepo.issue` now returns the token id). `welcome:<userId>` goes at the first verification and on Google sign-up. `schedule_created` / `schedule_updated` go to the user who made the change. Workspace emails (run summary, skip, pause, platforms dropped, low credits, payment failed) go to every owner, with `:<userId>` appended to 10's key.
- **Run summary.** The finalize handler calls the notifier after `finalized` and on every later attempt (so a crash between the two can't lose it); the key sends it once. Canceled runs send nothing. The delta is `visibilityDelta` against the schedule's previous finished run.
- **Low credits.** After any run reserves credits, the owners get `low_credits` when the balance is under `max(10, 10% of the plan allowance)`, keyed `low:<workspaceId>:<periodStart>` (the last plan reset, or the 1st of the UTC month without one).
- **Opt-outs** live on the user: `users.emailPrefs {runCompleted, lowCredits}`, in `Me` and `PATCH /me`, with a settings card. Everything else always sends.
- **Wiring.** `src/services.ts` builds the outbox, runs, schedules and the notifier once per process; `main.ts` shares them between HTTP, the worker and the `Scheduler` (`jobs/scheduler.ts`, 60 s ticks, first tick 1–3 s after boot, stopped before the worker drains on shutdown). Tests drive `scheduler.tick(now)` with a fake clock and `buildServices({ now })`.
- **7.5 soak.** `pnpm soak` (`apps/server/scripts/soak-schedules.ts`, default 60 s, `SOAK_SECONDS`) runs two instances (workers with sweepers, schedulers ticking every second) on real timers with fake providers and makes every slot due every 3 s. The first run (45 s): 120 scheduled runs, no duplicate slot, all finalized, every ledger balanced, a sent summary per run, the short-of-credits schedule paused after exactly 3 skip emails, no failed jobs.

**Rejected.**
- React Email: React and a renderer on the server for ten short emails, and the plain text would be a second template to keep in sync.
- Advancing `nextRunAt` alone (10's sketch): a crash between the claim and the run loses that slot silently.
- Counting `no_prompts` / `no_platforms` skips toward the auto-pause: those aren't fixed by a top-up, and the schedule-paused email talks about credits.

---

## D-027: Stage 8 hardening results and choices (2026-10-15, accepted)
**Context.** Stage 8 (TODO 8.1–8.5): load test, spend caps, security review, backups, Lighthouse and the full e2e run. The load test found two queue problems, and the security review found two medium and four low issues; none critical or high.

**Decision.**
- **Load test (8.1).** `pnpm loadtest` (`apps/server/scripts/load-test.ts`): 3 workspaces × 150 prompts × 5 platforms started together on one instance with the production worker settings. Fake providers with per-platform latency (median: ChatGPT 12 s, Perplexity 6 s, Gemini 5 s, Claude 25 s, AI Overviews 6 s, extractor 1.5 s; jitter 0.5–1.8×; assumptions until the 2.11 hand-check measures them), their own rate limit 10% above ours, plus 1% random 429s with Retry-After and 0.5% random 503s. `LOAD_TIME_SCALE` divides latencies and multiplies RPM for quick passes, but it distorts AIMD recovery and the poll interval, so only the real-time run counts.
- **Finding 1: concurrency, not RPM, was the limit.** A provider slot is held for the answer plus the extraction, so 4 Claude slots × ~27 s ≈ 9 checks a minute against a 50 RPM limit; three runs didn't finish in 36 minutes. New per-instance defaults (rpm / concurrency): OpenAI 400/24, Perplexity 45/10, Gemini 120/12, Anthropic 50/32, DataForSEO 600/16 (`concurrency ≈ rpm × seconds held / 60`, with headroom). `WORKER_CONCURRENCY` 24 → 96 (at least the sum of provider slots) and `MAX_INFLIGHT_PER_WORKSPACE` 10 → 64 (10 alone capped one run at ~45 checks a minute).
- **Finding 2: oldest-first claims served runs one after another** on the bottleneck providers (99% / 81% / 61% after 25 minutes). **Fair shares** (amends 04 § Claim): the worker reads, every 2 s, which workspaces have due jobs per provider; when two or more want a provider, a workspace may claim its next job only while it has the fewest of that provider's jobs in flight on this instance (`excludePairs`, a `$nor` in the claim).
- **Result (real time):** the three runs finished in 10.0, 10.9 and 11.6 minutes; when the first finished the others were 98% and 94% done; all 2,250 checks `ok`/`no_answer`, 29 429s and 8 503s all retried, no failed job, ledger = balance. A single run alone: 3.5 minutes (04 target ~6).
- **The "≤ ~8 min each" target can't hold for three runs at once** (amends CHECKLIST P8): 450 Perplexity checks at 45 RPM need 10 minutes and 450 Claude checks at 50 RPM need 9, on any queue. The pass bar is now "within ~20% of the RPM floor" (`LOAD_TARGET_MIN`, default 12) plus the fairness check (`LOAD_FAIR_PCT`: every run ≥ 75% done when the first finishes). Going faster needs higher provider tiers (then raise `PROVIDER_LIMITS`), not code.
- **Spend caps (8.2).** `apps/server/test/spendCaps.test.ts`: over a provider's cap its checks stay `pending` with their jobs `queued` and 0 attempts (never claimed), other platforms finish, the run stays `running` with no refund, and one alert fires per provider per day. On the next UTC day the same checks run and the run completes with nothing refunded. Over the extractor's (OpenAI) cap every platform waits; raising the cap releases them.
- **Security review (8.3)** against 07 and the v1 audit. Fixed:
  - *Medium, Google pre-hijack:* Google sign-in that links to an account whose email was never verified now removes its password and revokes its sessions, because someone else may have registered the address first. Verified accounts link as before.
  - *Medium, forgeable client IP:* the Render URL is public (Stripe webhook), so a direct request can set `X-Forwarded-For` and rotate past the per-IP limits (trust proxy 2). Added a backstop on login / register / Google keyed on the hop Render saw (`hopIp`, 10× the per-IP limit). **Still open (medium, go-live):** the full fix is a secret header added by Vercel that the API requires before trusting `X-Forwarded-For`. A plain Vercel rewrite can't add request headers, so it needs Vercel Routing Middleware. Revisit at 9.1; until then the per-email lockout and the backstop bound the damage.
  - *Low:* a refresh that loses the two-tab race inside the grace window no longer clears the cookies the winner just set (`RefreshRaceError`). The current-password check on `POST /me/password` uses the login lockout, keyed by user. Share tokens and `token=` values are masked in request logs, Sentry context and Vercel Analytics (`beforeSend`). CI has a `secrets` job (gitleaks 8.28, working tree plus full history; `.gitleaks.toml` skips v1).
  - *Info:* citations keep only `http(s)` URLs. `/share/*` gets `X-Robots-Tag: noindex, nofollow` and `Referrer-Policy: no-referrer` from `vercel.json`, not only the JS meta tag. Web Sentry stays off (D-018). The per-email lockout can lock a known address out of password login for a while (D-022 trade-off; Google and reset still work).
  - gitleaks found no secret in the v2 tree or the git history. It found ten in the untracked `backend/.env` (v1, live keys on this machine), which 07 already rotates at cutover (9.8).
- **Alerts (CHECKLIST P8):** job failures (last attempt, and a lease expiring on the last attempt) now log at error level as well as going to Sentry. A 5xx spike (10 within 5 minutes, per instance) logs one error line and one Sentry event per window (`ErrorSpikeAlarm`). Reconciliation mismatches and spend-cap hits already did both.
- **Backups (8.4).** `pnpm db:backup dump` runs `mongodump --archive --gzip` on the database named in `MONGODB_URI` and writes a manifest (per-collection counts before and after the dump, index names). `restore --archive … --to <scratch> --yes` refuses a name without `restore`/`scratch` or equal to the source, drops and restores into it with `--nsFrom/--nsTo`, checks collections, counts (between the before and after counts) and indexes against the manifest, and runs the ledger reconciliation on the copy. The URI reaches the tools through a temporary mode-600 config file. Tested with MongoDB Database Tools 100.19.1 (`test/backup.test.ts`, skipped when the tools aren't installed, so CI doesn't need them) and by hand through the CLI.
- **Lighthouse (8.5),** mobile defaults, built apps served locally with gzip, v1 from its existing `frontend/dist`:
  - Landing: v2 performance 82 / accessibility 95 / best practices 96 / SEO 82 (LCP 3.4 s, TBT 0 ms, 178 KB of JS) vs v1 62 / 76 / 96 / 82 (LCP 7.3 s, TBT 180 ms, 525 KB of JS).
  - Report (the public share page, same `ReportView`, 9 prompts × 5 platforms): 66 / 100 / 96 / 45 (LCP 5.4 s, 288 KB of JS). SEO 45 is the intended `noindex`. v1's report can't be measured without its backend, but it loads the same 525 KB bundle that scores 62 on v1's landing, so v2 is at least as good.
- **Full e2e with billing in test mode (8.5).** `scripts/e2e-api.mjs` now starts `apps/server/scripts/e2e-server.ts`: the real app with the in-memory `FakeStripe` (its checkout and portal pages live under `/api/__e2e/stripe/…`, and "Pay" delivers signed `checkout.session.completed` / `customer.subscription.created` / `invoice.paid` events to the real `/api/stripe/webhook`) and captured emails (`/api/__e2e/emails`). The script is never built or deployed and refuses `NODE_ENV=production`. New `e2e/billing.spec.ts`: an unverified user is refused, the verify link from the email works, a top-up adds 50 credits through the webhook, a canceled checkout charges nothing, Starter adds its 150 plan credits and keeps purchased ones, and the portal opens. All 4 e2e tests pass. A pass against real Stripe test mode waits on 6.1 (keys) and the Stripe CLI (`stripe listen`).

**Rejected.**
- A per-workspace share of provider concurrency (`ceil(concurrency / contenders)`), tried first: under an RPM limit nobody reaches the share, so oldest-first still wins.
- Requiring a Vercel secret header now: it can't be tested before go-live, and getting it wrong locks every user out of the API.
- A Node-only backup (EJSON export): `mongodump` keeps BSON types and indexes exactly, and the tools are a one-line install.

---

## D-028: Go-live settings and the Vercel edge secret (2026-10-15, accepted)
**Context.** TODO 9.1: write the exact settings for switching the existing Render service and Vercel project to v2, including D-027's open medium item (the API trusts a forgeable `X-Forwarded-For` on the public Render URL).

**Decision.**
- **Settings** are in [ops/go-live.md](ops/go-live.md): every Render and Vercel field, every env var with where its value comes from (copied v1 variable, new secret, or fixed), the dump before switching, index sync, Stripe check, smoke-test table and rollback.
- **The `/api` proxy moves from a `vercel.json` rewrite to Vercel Routing Middleware** (`apps/web/middleware.ts`, matcher `/api/:path*`, `@vercel/functions` `rewrite()` with `request.headers`). It rewrites to `API_ORIGIN` (a Vercel env var, so the Render host isn't in the repo) and adds `x-pv-edge-secret: <EDGE_PROXY_SECRET>`, keeping every other incoming header except `host`. Without `API_ORIGIN` or the secret it answers `503 UPSTREAM_UNAVAILABLE`, never the SPA page. `vercel.json` keeps the headers and an SPA fallback that excludes `/api/`.
- **The API side is opt-in and can't lock anyone out** (`edgeProxyGuard`, the first middleware). With `EDGE_PROXY_SECRET` set (≥ 32 characters), a request carrying the right secret keeps `X-Forwarded-For`; any other request has it cut down to its last entry (the address Render saw), which trust proxy 2 then reports as `req.ip`. The header is deleted before logging either way, and it's compared through SHA-256 digests with `timingSafeEqual`. Unset, nothing changes, and production logs a warning at boot. This answers D-027's reason for rejecting the secret: a wrong secret only makes everyone share the Vercel address for rate limits; it doesn't reject requests. The secret goes on Render last, after the middleware is live (go-live.md § 5).
- **Index sync is `pnpm admin sync-indexes [--yes]`** (`syncAllIndexes`: `diffIndexes()` for the dry run, `syncIndexes()` per model). The `db:sync-indexes` script the runbook named never existed. `src/db/registerModels.ts` imports every repo so all 19 models are registered. Tested on a replica set with `autoIndex` off (`test/syncIndexes.test.ts`) and by hand against the built server.
- **Builds pin pnpm with `npx --yes pnpm@11.7.0`** on both Render and Vercel instead of `corepack enable`: the lockfile and `allowBuilds` need pnpm 11, and this doesn't depend on Corepack or a preinstalled pnpm. Render's install adds `--prod=false`, because `NODE_ENV=production` would otherwise skip `tsup`. `NODE_VERSION=22` is set explicitly, since `engines` (`>=22.12`) would allow a newer Node. The Render build and start commands were checked locally with `NODE_ENV=production` (`/api/ready` green, worker on, secret absent from logs).
- **The pre-switch backup is the 9.4 dump** of v1's `promptverse` via `pnpm db:backup dump --out "$HOME\pv-backups"`: `promptverse_v2` is still empty then (D-015).
- **n8n export (9.3):** `scripts/scrub-n8n-export.mjs` writes one scrubbed file per workflow plus a README index to `reference/n8n-export/`. It drops credential ids, pinned and static data, sharing and owner info, and webhook ids and paths, and it redacts secret-named parameters and headers and secret-looking strings (provider keys, Stripe keys and `whsec_`, JWTs, Bearer/Basic values, `user:pass@` in URIs, keys in query strings, inline `btoa('user:pass')`). Its output still gets a manual read before committing.

**Rejected.**
- A Vercel Function that proxies with `fetch`: it costs an invocation per API call, has body-size and duration limits, and adds a hop. Middleware rewrites keep Vercel's own proxy.
- Rejecting requests without the secret: the Stripe webhook and Render's health check call Render directly.
- Building indexes at boot in production: two instances overlap during deploys, and an index build on a busy collection belongs in a step someone chose to run.

---

## Open questions (resolve during the noted phase)


- **Q-001 (P2):** Claude model and price. Do we keep Opus 5.5 for every plan, offer Sonnet 5.5 as the default, or weight credits per platform? Decide from the measured cost per check.
- **Q-002 (P2):** Load async AI Overviews in DataForSEO (`load_async_ai_overview`)? It costs more, but we under-count AI Overview presence without it. The choice is recorded per run either way. *Evidence so far (D-021):* the first live check returned only an empty async stub with the flag off. The extra cost is +$0.002 per check, so the live/advanced request goes from $0.002 to $0.004.
- **Q-003 (P5/P6):** Final plan matrix, using v1 values for now (see [06-credits-and-billing](architecture/06-credits-and-billing.md)):
  - prices
  - monthly credits
  - brand limits (v1 backend says agency = 20, the v1 UI says 5)
  - prompt cap per run
  - platforms per plan
- **Q-004 (resolved by D-018: keep the current domains):** Production domain. The PRD uses `promptverse.info`, so the plan is `app.promptverse.info` and `api.promptverse.info`. Confirm at cutover; no production changes before then.
- **Q-005 (resolved by D-018: only the owner uses it, no paying customers):** Are there any real paying Stripe subscriptions on the live account? Handle them before dropping v1.
