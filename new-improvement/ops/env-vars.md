# Environment variables

The server validates its env at boot with zod (`apps/server/src/config/env.ts`) and **refuses to start** if a required var is missing or malformed. Commit `.env.example` files with names only, never values.

**"Req" means required in production** (D-019). In development and test only `NODE_ENV` and `MONGODB_URI` are required (`pnpm dev` supplies both), `APP_URL` defaults to `http://localhost:5173`, and integration keys are only needed when the feature using them runs. Empty values (`KEY=`) count as unset.

## Server (`apps/server`, Render)

| Var | Req | Default | Notes |
|---|---|---|---|
| `NODE_ENV` | ✔ | | `development` \| `test` \| `production` (v1 had the typo `devolopment`) |
| `PORT` | | 4000 | Render injects this |
| `APP_URL` | ✔ | | The current live web origin (unchanged, D-018). Used for the Origin check and email links. The API is reached at `APP_URL/api` through the Vercel middleware |
| `RUN_HTTP` | | true | |
| `RUN_WORKER` | | true | Runs the worker, scheduler and sweeper in this process |
| `INSTANCE_ID` | | hostname | Shown in job `lockedBy` |
| `LOG_LEVEL` | | info | |
| `MONGODB_URI` | ✔ | | The existing Atlas cluster, database `promptverse_v2` (not the v1 `promptverse` DB). Locally, `pnpm db:dev` provides one |
| `JWT_ACCESS_SECRET` | ✔ | | ≥ 32 random bytes |
| `ACCESS_TOKEN_TTL` | | 15m | |
| `REFRESH_TOKEN_TTL_DAYS` | | 30 | |
| `GOOGLE_CLIENT_ID` | ✔ | | Same value as the web var |
| `OPENAI_API_KEY` | ✔ | | |
| `OPENAI_ANSWER_MODEL` | | `gpt-5.6-luna` | ChatGPT checks |
| `OPENAI_EXTRACT_MODEL` | | `gpt-5.4-mini` | Vendor extraction |
| `OPENAI_UTILITY_MODEL` | | `gpt-5.4-mini` | Brand analysis and prompt generation (P3 may pick a stronger model) |
| `PERPLEXITY_API_KEY` | ✔ | | |
| `PERPLEXITY_PRESET` | | `fast` | Agent API preset. Replaces `PERPLEXITY_MODEL` because Sonar Chat Completions has ended (D-020) |
| `GEMINI_API_KEY` | ✔ | | Paid key (the free tier is 20 requests/day) |
| `GEMINI_MODEL` | | `gemini-2.5-flash` | |
| `ANTHROPIC_API_KEY` | ✔ | | |
| `CLAUDE_MODEL` | | `claude-opus-5-5` | Q-001 |
| `CLAUDE_EFFORT` | | `low` | `low` \| `medium` \| `high` \| `xhigh` \| `max`. Set it explicitly: the Opus 5.5 default is `medium` |
| `CLAUDE_WEB_SEARCH_MAX_USES` | | 2 | |
| `CLAUDE_REFUSAL_FALLBACK` | | true | Server-side refusal fallback (`fallbacks: "default"`). The answering model is recorded (D-021) |
| `DATAFORSEO_LOGIN` / `DATAFORSEO_PASSWORD` | ✔ | | |
| `DATAFORSEO_LOAD_ASYNC_AIO` | | false | Q-002 |
| `PROVIDER_LIMITS` | | built-in | JSON override, e.g. `{"perplexity":{"rpm":45,"concurrency":6}}`. Built-in (rpm / concurrency, D-027): OpenAI 400/24, Perplexity 45/10, Gemini 120/12, Anthropic 50/32, DataForSEO 600/16 |
| `PROVIDER_DAILY_CAP_USD` | | built-in | JSON per provider, e.g. `{"anthropic":50,"openai":50}`. Built-in: OpenAI 50, Perplexity 25, Gemini 25, Anthropic 75, DataForSEO 15 (USD per UTC day, D-023). Over a cap, that provider's jobs wait; over the OpenAI cap every check waits, because the extractor runs on OpenAI |
| `MAX_INFLIGHT_PER_WORKSPACE` | | 64 | Upper bound per workspace on one instance; fair shares per provider apply below it (D-027) |
| `WORKER_CONCURRENCY` | | 96 | Jobs one instance runs at once; the provider limits apply on top (D-023, D-027: sized by the 8.1 load test) |
| `SHUTDOWN_GRACE_MS` | | 50000 | Keep below Render `maxShutdownDelaySeconds` |
| `STRIPE_SECRET_KEY` | ✔ | | Existing account. Test key in development |
| `STRIPE_WEBHOOK_SECRET` | ✔ | | Signing secret of the existing endpoint (`/api/stripe/webhook`); locally, the one `stripe listen` prints |
| `STRIPE_PRICE_STARTER` / `_PRO` / `_AGENCY` | ✔ | | Subscription price ids (the existing v1 prices) |
| `STRIPE_PRICE_TOPUP_50` / `_100` / `_200` | ✔ | | One-time price ids (the existing v1 prices) |
| `STRIPE_PORTAL_CONFIGURATION_ID` | | account default | Customer Portal configuration (`bpc_…`) printed by `pnpm admin stripe-portal --yes` (D-025). Unset: the account's default portal settings |
| `EMAIL_DRIVER` | | (unset) | Unset: `resend` when `RESEND_API_KEY` is set, else `log`. `log` forces the log driver even with a key; `resend` requires the key (D-018, D-026) |
| `RESEND_API_KEY` | | | Optional. Setting it switches email to Resend (needs a verified sender domain) |
| `EMAIL_FROM` | | `PromptVerse <noreply@promptverse.info>` | |
| `FAKE_PROVIDERS` | | false | Tests and local dev: the engine returns canned answers instead of calling providers |
| `SENTRY_DSN` | | | Optional; Sentry is off when empty |
| `EDGE_PROXY_SECRET` | | | ≥ 32 characters, the same value as in Vercel. When set, `X-Forwarded-For` is trusted only on requests carrying it (the Vercel middleware adds it); others are keyed on the address Render saw (D-028). Unset: trusted as before, and production logs a warning at boot |

**Only for `pnpm db:backup` (8.4), on the machine that runs it:** `MONGO_TOOLS_DIR` (folder holding `mongodump` / `mongorestore`, if they aren't on `PATH`) and `RESTORE_MONGODB_URI` (cluster for the scratch restore; default: `MONGODB_URI`'s cluster).

## Web (`apps/web`, Vercel, build time)

| Var | Req | Notes |
|---|---|---|
| `VITE_GOOGLE_CLIENT_ID` | ✔ | |
| `VITE_SENTRY_DSN` | | |

**Vercel runtime (read by `apps/web/middleware.ts`, not by Vite):** `API_ORIGIN` (✔, the Render service URL, e.g. `https://<name>.onrender.com`) and `EDGE_PROXY_SECRET` (✔, same value as the server's). Without either, `/api/*` answers 503. Not used locally: Vite proxies `/api` itself.

## v1 vars that go away

| v1 var | Why |
|---|---|
| `N8N_OPENAI`, `N8N_WEBHOOK_URL`, `N8N_COMPETITOR_ANALYSIS_WEBHOOK_URL`, `N8N_WEBHOOK_SEND_MAIL`, `N8N_NEW_SCHEDULE_MAIL`, `N8N_API_KEY`, `N8N_WEBHOOK_SECRET`, `VITE_N8N_WEBHOOK_URL` | n8n is retired |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY` | Never used |
| `GOOGLE_CLIENT_SECRET` | Not needed for ID-token sign-in |
| `JWT_SECRET`, `JWT_EXPIRE` | Replaced by `JWT_ACCESS_SECRET` and `ACCESS_TOKEN_TTL` |
| `STRIPE_PUBLISHABLE_KEY`, `VITE_STRIPE_PUBLISHABLE_KEY` | Unused (we use hosted Checkout and Portal) |
| `STRIPE_PRICE_ID_*`, `STRIPE_TOPUP_PRICE_ID_*` | Renamed (see above) |
| `FRONTEND_URL` | Renamed to `APP_URL` |
| `VITE_API_URL` | The web app calls same-origin `/api` (D-018) |

## Environments

| Env | Web | API | DB | Stripe | Email |
|---|---|---|---|---|---|
| local | `localhost:5173` | `localhost:5173/api` (Vite proxy → `localhost:4000`) | in-memory replica set (`pnpm db:dev`) or a dev DB on the existing cluster | test | `log` driver |
| production | the current live domain (unchanged) | same origin `/api` (Vercel middleware → the existing Render service) | existing cluster, DB `promptverse_v2` | test until real billing is wanted | `log`, or `resend` if a key is set |

There's no staging environment (D-018). Transactions need a replica set: `pnpm db:dev` and the tests use `MongoMemoryReplSet`, so Docker isn't needed.
