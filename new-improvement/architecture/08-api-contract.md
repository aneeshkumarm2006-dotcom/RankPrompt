# 08: API contract

- **Base URL:** `/api` on the web origin (D-018). Every path below is relative to it: `GET /health` is served at `/api/health`. In production the Vercel middleware proxies `/api/*` to the Render service (D-028); in dev Vite proxies it to `http://localhost:4000`.
- **Format:** JSON only. Every request and response schema lives in `packages/shared/src/api/<module>.ts` as zod, and the web client parses responses with those same schemas.
- **Success:** the resource itself, or `{ items, nextCursor }` for lists (cursor pagination on `_id`/`createdAt`).
- **Error:** `{ error: { code, message, details? } }` (see 07).
- **Auth column below:** `—` = public, `user` = signed in, `owner` = workspace owner (today every member is an owner), `stripe` = signature-verified.

## Health and config
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | /health | — | Liveness: `{ok, version}` |
| GET | /ready | — | Readiness: DB ping, worker heartbeat age |
| GET | /plans | — | Plans, top-ups, limits (from `shared/plans.ts`) |
| GET | /meta | — | Countries, languages and platforms (with labels), for forms |

## Auth and me
| Method | Path | Auth | Body → Response |
|---|---|---|---|
| POST | /auth/register | — | `{name, email, password, ref?}` → 201 `Me` + cookies (409 `CONFLICT` if the email is taken) |
| POST | /auth/login | — | `{email, password}` → `Me` + cookies |
| POST | /auth/google | — | `{credential, ref?}` → `Me` + cookies |
| POST | /auth/refresh | cookie | → 204, rotates cookies |
| POST | /auth/logout | user | → 204, clears cookies |
| POST | /auth/logout-all | user | → 204, revokes every session of the user (this one too) and clears cookies ("sign out everywhere", D-024) |
| POST | /auth/verify-email | — | `{token}` → 204 |
| POST | /auth/resend-verification | user | → 204 |
| POST | /auth/forgot-password | — | `{email}` → 204 (always) |
| POST | /auth/reset-password | — | `{token, password}` → 204 |
| GET | /me | user | → `Me` |
| PATCH | /me | user | `{name?, avatarUrl?, emailPrefs?: {runCompleted?, lowCredits?}}` → `Me` |
| POST | /me/password | user | `{currentPassword, newPassword}` → 204 |

`Me` = `{ user: {id, name, email, emailVerified, avatarUrl, authMethods[], emailPrefs: {runCompleted, lowCredits}}, workspace: {id, name, plan, credits: {plan, purchased, total}, limits: {brands, brandsUsed, maxPromptsPerRun, platforms[]}, referralCode} }`.

## Brands
| Method | Path | Auth | Body → Response |
|---|---|---|---|
| POST | /brands/analyze | user | `{name, websiteUrl}` → `{domain, summary, categories[], suggestedAliases[]}` (rate-limited) |
| GET | /brands | user | → `BrandListItem[]` = `Brand` + `{promptCount, activeSchedules, latestRun: {id, status, createdAt, visibility} \| null}` |
| POST | /brands | user | `{name, websiteUrl, summary?, categories?, aliases?, competitors?, defaults?}` → 201 `Brand` (409 `BRAND_LIMIT_REACHED`, 409 `BRAND_EXISTS`, 403 `PLATFORM_NOT_IN_PLAN`) |
| GET | /brands/:id | user | → `Brand` (archived brands too, with `archivedAt`; changing one is a 404) |
| PATCH | /brands/:id | user | partial `{name, websiteUrl, aliases, categories, defaults}` → `Brand` |
| PUT | /brands/:id/competitors | user | `{competitors: {id?, name, domain, aliases[]}[]}` → `Brand` (passing an existing `id` keeps it) |
| DELETE | /brands/:id | user | → 204 (archives the brand and pauses its schedules; runs are kept) |

## Prompts
| Method | Path | Auth | Body → Response |
|---|---|---|---|
| GET | /brands/:id/prompts | user | `?includeArchived` → `Prompt[]` |
| POST | /brands/:id/prompts/generate | user | `{categories: string[], count: 1..maxPromptsPerRun, scope, country, city?, language}` → `{drafts: {text, category}[]}` (not saved; 422 `TOO_MANY_PROMPTS`; rate-limited) |
| POST | /brands/:id/prompts | user | `{prompts: {text, category, source}[]}` → 201 `Prompt[]` (the ones created; exact repeats of active prompts are skipped) |
| PATCH | /prompts/:id | user | `{text?, category?}` → `Prompt`: a new one when the text changes (old one archived, `replacesId` set), the same one when only the category changes |
| DELETE | /prompts/:id | user | → 204 (archive) |

## Runs
| Method | Path | Auth | Body → Response |
|---|---|---|---|
| POST | /runs/estimate | user | `{brandId, promptIds[], platforms[]}` → `{checks, credits, balance: {plan, purchased}, sufficient}` |
| POST | /runs | user | header `Idempotency-Key`; `{brandId, promptIds[], platforms[], country, city?, language, scope}` → `Run` (402 `INSUFFICIENT_CREDITS`, 403 `PLATFORM_NOT_IN_PLAN`, 422 `TOO_MANY_PROMPTS`) |
| GET | /runs | user | `?brandId&status&trigger&cursor` → `{items: RunListItem[], nextCursor}` |
| GET | /runs/:id | user | → `Run` (status, live `progress {total, ok, noAnswer, failed, canceled, pending}`, aggregates when final) |
| GET | /runs/:id/results | user | `?platform&category&status&mentioned&cursor` → `{items: CheckResult[], nextCursor}` |
| POST | /runs/:id/cancel | user | → `Run` |
| DELETE | /runs/:id | user | → 204 (only in a final status) |
| GET | /runs/:id/export.xlsx | user | → XLSX file (Summary, Prompt Rankings, AI Answers, Citations, Competitors) |
| POST | /runs/:id/shares | user | `{expiresInDays?}` → `{id, url, token}` (the token is shown once) |
| GET | /runs/:id/shares | user | → `Share[]` (no tokens) |
| DELETE | /shares/:id | user | → 204 |
| GET | /public/shares/:token | — | → `PublicReport` (see 07) |

`CheckResult` = `{id, promptId, promptText, category, platform, status, answer, citations[], vendors[], brand{mentioned, rank, cited, citedUrl, snippet}, competitors[{competitorId, name, mentioned, rank, cited}], model, error?}`.

Notes (D-023):
- `POST /runs` needs the `Idempotency-Key` header (8–128 characters; 400 without it). A replay with the same key returns 200 and the same run. A platform the server has no API key for gives 503 `UPSTREAM_UNAVAILABLE` before anything is charged; an archived or unknown prompt gives 400.
- `POST /runs/:id/cancel` on a finished run gives 409 `CONFLICT`. `DELETE /runs/:id`, `GET /runs/:id/export.xlsx` and `POST /runs/:id/shares` give 409 `RUN_NOT_FINAL` until the run has finished.
- `CheckResult.error` is `{code, message}` with a fixed, safe message per code; the provider's own text never reaches the client.
- `Run.aggregates` is null until the run is final, and so is `GET /brands` `latestRun.visibility`.
- Insights `from`/`to` are ISO dates and default to the last 90 days.

## Insights (brand level)
| Method | Path | Auth | Response |
|---|---|---|---|
| GET | /brands/:id/insights/overview | user | latest run aggregates, the delta vs the previous comparable run, counts, next scheduled run |
| GET | /brands/:id/insights/trend | user | `?from&to&platform` → points (see 05) |
| GET | /brands/:id/insights/competitors | user | `?runId` (default: latest) → per competitor metrics, per-prompt rank matrix, suggested competitors |
| GET | /brands/:id/insights/sources | user | `?from&to&platform` → cited domains with counts, platforms, sample URLs and prompts |
| GET | /brands/:id/insights/prompts | user | `?from&to` → per prompt: history across runs `[{runId, date, trigger, perPlatform{mentioned, rank, cited}}]` |

## Schedules
| Method | Path | Auth | Body → Response |
|---|---|---|---|
| GET | /brands/:id/schedules | user | → `Schedule[]` (includes `nextRunAt`, `creditsPerRun` and `lastSkip`; readable for an archived brand) |
| POST | /schedules | user | `{brandId, label, frequency, hour, timezone, weekday?, dayOfMonth?, platforms[], promptSelection, country, city?, language, scope}` → `Schedule` |
| PATCH | /schedules/:id | user | partial of the above → `Schedule` (merged with the stored schedule and checked as a whole; a timing change recomputes `nextRunAt`) |
| POST | /schedules/:id/pause | user | → `Schedule` |
| POST | /schedules/:id/resume | user | → `Schedule` (resets `consecutiveSkips`) |
| POST | /schedules/:id/run-now | user | header `Idempotency-Key` → 201 `Run` (200 on a replay; same as `POST /runs`, using the schedule's config; a manual run linked to the schedule) |
| DELETE | /schedules/:id | user | → 204 |

Errors: an unknown zone, a frequency the plan doesn't allow (free: weekly and monthly) or archived fixed prompts are 400 `VALIDATION_FAILED` with the field path; platforms outside the plan 403 `PLATFORM_NOT_IN_PLAN`; more than 10 schedules on a brand 409 `CONFLICT`. Changing a schedule of an archived brand is 404 (D-026).

## Billing and credits
| Method | Path | Auth | Body → Response |
|---|---|---|---|
| POST | /billing/checkout | owner | `{tier}` → `{url}` |
| POST | /billing/topup | owner | `{pack}` → `{url}` |
| POST | /billing/portal | owner | → `{url}` |
| GET | /billing/subscription | user | → `{tier, status, currentPeriodEnd, cancelAtPeriodEnd, pendingTier}` |
| POST | /stripe/webhook | stripe | raw body → 200/500 |
| GET | /credits/ledger | user | `?cursor&limit` → `{items: LedgerEntry[], nextCursor}`, newest first; `LedgerEntry` = `{id, delta, bucket, reason, runId, note, balanceAfter{plan, purchased}, createdAt}` |
| GET | /referrals | user | → `{code, link, referredCount, creditedCount, creditsEarned}` |
| GET | /survey | user | → `{completed, completedAt}` (answers schema: `surveyAnswersSchema` in `shared/api/billing.ts`) |
| POST | /survey | user | `{answers}` → `{creditsAwarded}` |

## Error codes (enum in `shared/errors.ts`)

`VALIDATION_FAILED, UNAUTHENTICATED, TOKEN_EXPIRED, FORBIDDEN, NOT_FOUND, CONFLICT, INVALID_CREDENTIALS, EMAIL_NOT_VERIFIED, BRAND_LIMIT_REACHED, BRAND_EXISTS, INSUFFICIENT_CREDITS, PLATFORM_NOT_IN_PLAN, TOO_MANY_PROMPTS, SUBSCRIPTION_EXISTS, RUN_NOT_FINAL, RATE_LIMITED, INTERNAL, UPSTREAM_UNAVAILABLE` (503: an AI provider or Google sign-in failed or isn't configured; retryable, D-022).

## v1 → v2 endpoint mapping (for porting)
| v1 | v2 |
|---|---|
| `/api/auth/*` | `/auth/*`, `/me` |
| `/api/brand/favicon` | removed (the client builds the favicon URL) |
| `/api/brand/save, list, :id, limit-info` | `/brands`, `/me.workspace.limits` |
| `/api/openai/analyze-brand, generate-categories` | `/brands/analyze` |
| `/api/openai/generate-prompts` | `/brands/:id/prompts/generate` |
| `/api/reports/save, save-progress` | `/runs` (drafts removed) |
| `/api/reports/list, :id, by-brand, brand/:id` | `/runs`, `/runs/:id`, `/runs/:id/results` |
| `/api/reports/:id/share`, `/shared/:token` | `/runs/:id/shares`, `/public/shares/:token` |
| `/api/reports/brand/:id/visibility-trend` | `/brands/:id/insights/trend` |
| `/api/reports/:id/competitor-comparison` | `/brands/:id/insights/competitors` |
| `/api/analysis/*` (n8n endpoints) | removed |
| `/api/analysis/schedule-from-report`, `scheduled-*` | `/schedules*` |
| `/api/credits/activity, referrals, survey*` | `/credits/ledger`, `/referrals`, `/survey` |
| `/api/stripe/*` | `/billing/*`, `/stripe/webhook` (same path as v1, so the existing Stripe endpoint keeps working) |
