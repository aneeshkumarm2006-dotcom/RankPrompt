# v1 audit: what went wrong, and the v2 rule that prevents it

This is a summary of `AUDIT.md` (about 55 issues) plus the 2026-10-13 code exploration. Use it as a "never again" list. File references point at the v1 code in `backend/` and `frontend/`.

## n8n coupling and paid work

| v1 problem | Where | v2 rule |
|---|---|---|
| The browser calls the n8n analysis webhook directly, one request per prompt, all through `Promise.all`. Closing the tab loses the run. | `frontend/src/pages/Reports.jsx:353-455` | All paid work runs server-side as queued jobs (04). |
| Credits are charged afterwards, using a `promptsCount` the client supplies. Sending 0 gives a free run. | `reportController.js:35` | Credits are reserved server-side before any work starts, and the cost is computed on the server (06). |
| The n8n API-key check is `apiKey !== process.env.N8N_API_KEY`. When the env var is unset, a request with no header passes. That exposes `/prompts-due` (everyone's schedules with names and emails) and `/n8n-save-report` (create reports and spend credits for any user). | `analysisController.js:553,595,680,972,1053` | No machine-to-machine endpoints exist. Env is validated at boot, and a missing secret means the server doesn't start. |
| n8n probably wrote to Mongo directly (it sent `{$oid}` payloads and only passed ids to the mail webhooks). | inferred | Only `apps/server` touches the DB. |
| `generateWebhookToken` signs `req.user.userId`, which is always undefined. | `analysisController.js:710` | Typed `ctx`. |
| Dead endpoints `/analysis/initiate` and `/store-prompts` crash on undefined variables (`hasValidResponse`, `categories`). | `analysisController.js:294,429` | TS strict, plus lint for unused code. |

## Credits and billing

| v1 problem | v2 rule |
|---|---|
| `addCredits` and `deductCredits` read, modify and then save, so concurrent requests lose updates or overspend. | Guarded atomic `$inc`, with the ledger insert in the same transaction. |
| Manual runs charge 1 credit per prompt. Scheduled runs charge prompts × platforms. | One rule: 1 credit per check. |
| Stripe webhooks aren't idempotent. Duplicate deliveries double the credits. | `stripe_events` dedupe plus unique ledger keys. |
| `subscription.updated` writes back a credits value it read earlier, which races with checkout and loses credits. | The subscription handler never touches credits. Only `invoice.paid` grants plan credits. |
| Renewals never add credits (`invoice.payment_succeeded` only logs). | `invoice.paid` with `subscription_cycle` resets plan credits. |
| Cancelling sets `credits: 0`, wiping top-ups and bonuses. | Two buckets; cancelling zeroes only the `plan` bucket. |
| Plan changes made in the billing portal are ignored, because the plan is read from the original checkout metadata. | The tier comes from the subscription's price id, re-fetched from Stripe. |
| Every checkout creates a new Stripe customer, leaving earlier subscriptions orphaned but still billing. | One customer per workspace. Checkout passes `customer` and rejects a second subscription. |
| Stripe statuses outside the enum get written, and later `save()` calls fail. | `mapStripeStatus()`. |
| The global rate limiter also covers the Stripe webhook, and there is no `trust proxy`. | The webhook is exempt, and `trust proxy` is set to 1. |
| Referral farming: unverified throwaway accounts earn 50 + 10 credits each. | The referral credit waits for email verification. No self-referral. |
| Survey grant and survey insert aren't atomic, so a failure leaves the user stuck. | One transaction. |
| Plan prices are hardcoded in the UI (`BuyCredits.jsx`, `Pricing.jsx`). The brand limit for agency says 5 in the UI but 20 in the backend. | `shared/plans.ts` served by `GET /plans`. |

## Auth and security

| v1 problem | v2 rule |
|---|---|
| The JWT is returned in the response body and stored in localStorage, alongside a `SameSite=None` cookie. Logout doesn't revoke it, and it stays valid for 7 days. | httpOnly same-site cookies only, a 15-minute access token, rotating refresh tokens, and server-side revocation. |
| The refresh token is signed with the same secret as the access token, and is never stored or checked. | Opaque refresh tokens, hashed in `sessions`. |
| Two `sendTokenResponse` implementations return different user shapes (`id` vs `_id`). | One `Me` DTO. |
| Login reveals whether an account exists and which provider it uses. | A generic `INVALID_CREDENTIALS`. |
| Google sign-in doesn't check `email_verified`, and links accounts by email silently. | `email_verified` is required, and linking is explicit. |
| `getScheduledPrompts` accepts `?userId=` from any user (IDOR). | Workspace scope in repos, a plugin, and a cross-workspace test suite. |
| NoSQL operator injection is possible in `email` and `referralCode` (no sanitizing). | zod string validation plus `sanitizeFilter`. |
| SSRF in `getFavicon`: arbitrary hosts, sockets left open, about 18 s per request. | The server never fetches user-supplied URLs. |
| `express.urlencoded` plus `SameSite=None` cookies allow CSRF through cross-site form POSTs. | JSON only, Lax cookies and an Origin check. |
| Raw `error.message` is returned in 500 responses. | Generic error envelope; details go to Sentry. |
| Live Stripe keys sit in the local `backend/.env`, and `NODE_ENV=devolopment`. | Test keys on staging, live keys only in production env. Rotate at cutover. |
| Supabase is initialised but never used. Unused dependencies: `@google/genai`, `express-validator`. | Removed. |

## Data integrity

| v1 problem | v2 rule |
|---|---|
| `reportData` is whatever blob the browser posted, so its shape depends on whatever n8n returned. | Typed `run_results` written only by the engine. |
| Google AIO has three spellings (`google_ai_overview`, `google_ai_overviews`, `googleAiOverviews`). | One `Platform` enum. |
| "Visible" has three definitions, and per-platform percentages are averaged. | `shared/metrics.ts`, pooled totals (05). |
| `stats.successRate` (HTTP success) is labelled and used as visibility. | Removed. |
| Deleting a brand orphans PromptSent and PromptResponse documents, and leaves schedules without a brandId still running. | Brands are archived and their schedules paused. Runs own their results. |
| Duplicate brand-name check is case-sensitive and has no unique index. | Unique `(workspaceId, domain)` among active brands. |
| The schedule copies the prompt array. The `MyBrands` prompt editor sends plain strings and drops category, ids and flags. | An immutable prompt library referenced by id. One editor. |
| Static vs scheduled reports are guessed from date order. | `run.trigger`. |
| The competitor comparison is tied to the latest report and vanishes when a new run lands. | Computed per run, for all tracked competitors. |
| `null` rank renders as 0 or `#undefined`. | `Metric.rate` is `null` and displays as "—". |

## Frontend structure

| v1 problem | v2 rule |
|---|---|
| About 40 copies of `import.meta.env.VITE_API_URL \|\| 'http://localhost:5000'`, missing `/api`, so data calls 404 if the env is missing. | One typed client. The build fails without `VITE_API_URL`. |
| No data cache: five brand tabs each refetch the brand and every report, including full `reportData`. | TanStack Query, plus paginated, server-filtered results. |
| ReportView and SharedReport are about 80% duplicated and have drifted apart. | One `ReportView` with `readOnly`. |
| Files of 1,129, 1,144 and 1,254 lines. | About 300 lines per file at most. |
| Dead code: `Dashboard.jsx`, `AnalysisProgressModal`, `SaveBrandModal`, `App.css`, `generateReportPDFFromHTML`, `authFetch`. | Removed. |
| Calls to backend routes that don't exist: `PUT /brand/:id`, `GET /analysis/status/:id`, `POST /stripe/sync-subscription`. | The shared contract makes a missing route a compile error. |
| Login doesn't refresh the user, so the sidebar shows 0 credits and the credit checks are skipped. | `useMe()` invalidated after auth. |
| Filters on the performance summary are bound to state but never applied. "1 active schedule" is hardcoded. | Real queries. |
| Links to `/terms` and `/privacy` go nowhere. | Real static pages. |
