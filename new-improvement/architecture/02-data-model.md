# 02: Data model (MongoDB, v2 database)

## Rules that apply to every collection

1. **Every owned document has `workspaceId`, and every compound index starts with it.** The workspace-scope Mongoose plugin throws if a query on an owned collection has no `workspaceId` in its filter (see 07).
2. **Timestamps:** `createdAt` and `updatedAt` on all collections (Mongoose `timestamps: true`). Times are stored in UTC.
3. **Soft delete:** brands and prompts use `archivedAt`. Runs are hard-deleted on request, along with their results.
4. **Raw provider payloads are kept for 30 days only**, in a separate collection with a TTL index.
5. **Money and credit fields are integers.** USD cost is stored as micro-dollars (`costMicros`) to avoid float drift.
6. **Enums come from `packages/shared/enums.ts`.**
   - `Platform = 'chatgpt'|'perplexity'|'gemini'|'claude'|'google_aio'`
   - `RunStatus = 'queued'|'running'|'finalizing'|'completed'|'partial'|'failed'|'canceled'`
   - `CheckStatus = 'pending'|'running'|'ok'|'no_answer'|'failed'|'canceled'`

## Identity and tenancy

### `users`
| Field | Type | Notes |
|---|---|---|
| email | string | lowercase, unique |
| emailVerifiedAt | Date \| null | |
| passwordHash | string \| null | bcrypt (cost 12). Null for Google-only accounts |
| googleId | string \| null | unique sparse |
| name, avatarUrl | string | |
| role | `'user' \| 'admin'` | admin is reserved for scripts and support |
| defaultWorkspaceId | ObjectId | the personal workspace |
| lastLoginAt | Date | |
Indexes: `{email:1}` unique; `{googleId:1}` unique sparse.

### `sessions`
| Field | Type | Notes |
|---|---|---|
| userId | ObjectId | |
| workspaceId | ObjectId | the workspace the access token is issued for (D-022) |
| familyId | string | rotation family; reusing a token revokes the whole family |
| tokenHash | string | SHA-256 of the refresh token |
| userAgent, ip | string | |
| expiresAt | Date | TTL index |
| revokedAt, replacedBy | Date / ObjectId | |
Indexes: `{tokenHash:1}` unique; `{userId:1}`; `{expiresAt:1}` TTL (expireAfterSeconds 0).

### `auth_tokens` (email verification and password reset)
`{userId, type: 'verify_email'|'reset_password', tokenHash, expiresAt (TTL), usedAt}`. Indexes: `{tokenHash:1}` unique; TTL on `expiresAt`.

### `workspaces`
| Field | Type | Notes |
|---|---|---|
| name | string | personal: "<name>'s workspace" |
| plan | `{ tier: 'free'\|'starter'\|'pro'\|'agency', status: 'active'\|'past_due'\|'canceled'\|'none', currentPeriodEnd, cancelAtPeriodEnd, pendingTier? }` | |
| stripe | `{ customerId, subscriptionId, priceId }` | `customerId` is unique sparse |
| credits | `{ plan: int, purchased: int }` | a cache of the ledger, always changed atomically together with a ledger insert |
| planCredits | `{ periodStart: Date\|null, allowance: int }` | the billing period plan credits were last reset for, and its allowance (D-025) |
| referralCode | string | 8 characters, unique |
| settings | `{ timezone, defaultCountry, defaultLanguage }` | |
| branding | object | **reserved for white-label (deferred)** |
| lockVersion | int | bumped inside transactions that must serialise per workspace, e.g. the brand-limit check (D-022) |
Indexes: `{'stripe.customerId':1}` unique sparse; `{referralCode:1}` unique.

### `memberships`
`{workspaceId, userId, role: 'owner'|'admin'|'member'}`. Indexes: `{workspaceId:1, userId:1}` unique; `{userId:1}`.

## Brands and prompts

### `brands`
| Field | Type | Notes |
|---|---|---|
| workspaceId | ObjectId | |
| name | string | |
| domain | string | registrable domain via `tldts` (e.g. `canadim.com`). Unique per workspace among non-archived brands |
| websiteUrl | string | as the user entered it, normalised to https |
| aliases | string[] | name variants used for matching. Includes `name` |
| summary | string | from brand analysis |
| categories | `{ name, description, source: 'generated'\|'custom' }[]` | at most 10 |
| competitors | `{ _id, name, domain, aliases[] }[]` | tracked competitors. No hard limit; the plan may cap it |
| defaults | `{ country (ISO2), city?, language, scope: 'national'\|'local', platforms: Platform[] }` | used as the starting point for a run |
| archivedAt | Date \| null | |
Indexes: `{workspaceId:1, domain:1}` unique, partial filter `archivedAt: {$type: 'null'}` (partial indexes don't accept `archivedAt: null`); `{workspaceId:1, createdAt:-1}`.

### `prompts`
| Field | Type | Notes |
|---|---|---|
| workspaceId, brandId | ObjectId | |
| text | string | **immutable** once created |
| category | string | |
| source | `'generated'\|'manual'` | |
| replacesId | ObjectId \| null | set when created by editing another prompt |
| archivedAt | Date \| null | |
Indexes: `{workspaceId:1, brandId:1, archivedAt:1, createdAt:1}`.

## Runs and results

### `runs`
| Field | Type | Notes |
|---|---|---|
| workspaceId, brandId | ObjectId | |
| trigger | `'manual'\|'scheduled'` | |
| scheduleId | ObjectId \| null | |
| createdBy | ObjectId \| null | user id; null for scheduled runs |
| idempotencyKey | string | from the request header (manual) or `schedule:<id>:<slot>` (scheduled) |
| config | `{ platforms: Platform[], country, city?, language, scope, aioLoadAsync: bool }` | |
| brandSnapshot | `{ name, domain, aliases[], competitors[] }` | frozen at creation so later brand edits don't change old results |
| promptIds | ObjectId[] | |
| promptSetHash, platformsHash | string | sha1 of the sorted prompt ids / platforms; the trend marks a change (05, D-023) |
| status | RunStatus | |
| counts | `{ total, ok, noAnswer, failed, canceled }` | written once at finalize. While running, progress is counted live (see 04) |
| credits | `{ reserved, charged, refunded, split: { plan, purchased }, refundedSplit: { plan, purchased } }` | cumulative over generations: `split` is what each bucket gave, `refundedSplit` what finalize gave back |
| generation, finalizedGen | int | 1 and 0 at creation. An admin rerun of failed checks starts the next generation; finalize runs once per generation (D-023) |
| aggregates | object | see 05; recomputable from the results |
| engineVersion, metricsVersion | string | |
| models | `Record<Platform, string>` | the model that actually answered for each platform |
| costMicros | int | sum over the results |
| startedAt, finishedAt, canceledAt | Date | |
| error | string \| null | |
Indexes:
- `{workspaceId:1, idempotencyKey:1}` unique
- `{workspaceId:1, brandId:1, createdAt:-1}`
- `{status:1, updatedAt:1}` (sweeper)
- `{scheduleId:1, createdAt:-1}`

### `run_results` (one per check)
| Field | Type | Notes |
|---|---|---|
| workspaceId, runId, brandId, promptId | ObjectId | |
| promptText, category | string | snapshot |
| platform | Platform | |
| status | CheckStatus | |
| answer | string | the platform's answer text as returned (markdown) |
| citations | `{ url, domain, title, position }[]` | cleaned (tracking params stripped) and deduped |
| vendors | string[] | ordered extractor output |
| brand | `{ mentioned, rank: int\|null, cited, citedUrl\|null, snippet\|null }` | |
| competitors | `{ competitorId, name, mentioned, rank\|null, cited }[]` | |
| suggested | string[] | vendors that matched neither the brand nor a tracked competitor (05) |
| model | string | |
| latencyMs, costMicros, attempts | int | |
| error | `{ code, message } \| null` | `message` is internal; the API shows a fixed text per `code` |
| leaseId | ObjectId \| null | the job lease that owns the check while it runs; only it may write the outcome (D-023) |
| engineVersion | string \| null | the engine that produced this result |
| schemaVersion | int | |
| finishedAt | Date \| null | |
Indexes:
- `{runId:1, status:1}` (progress and finalize)
- `{workspaceId:1, runId:1, platform:1}`
- `{workspaceId:1, brandId:1, promptId:1, createdAt:-1}` (prompt history)
- `{workspaceId:1, brandId:1, createdAt:-1}` (insights)

### `run_result_raw`
`{ workspaceId, runId, resultId, provider, response, extractorResponse, createdAt }` (`response` holds the provider request and response(s)). Indexes: `{resultId:1}`; `{workspaceId:1, runId:1}`; TTL on `createdAt`, 30 days.

## Jobs and schedules

### `jobs`
| Field | Type | Notes |
|---|---|---|
| type | `'check'\|'finalize_run'\|'reconcile_ledger'\|'send_email'\|…` | |
| payload | object | e.g. `{ resultId }` |
| workspaceId | ObjectId \| null | for fairness caps |
| runId | ObjectId \| null | the run a check or finalize job belongs to (cancel and delete use it) |
| providerKey | string \| null | e.g. `openai`, `perplexity`, used by the limiter |
| status | `'queued'\|'running'\|'done'\|'failed'\|'canceled'` | |
| runAt | Date | the next time the job can be claimed |
| attempts, maxAttempts | int | |
| leaseId | ObjectId \| null | fencing token |
| lockedBy | string \| null | instance id |
| lockedUntil | Date \| null | renewed while the job runs |
| lastError | string \| null | |
| dedupeKey | string \| null | unique sparse; stops the same job being enqueued twice (e.g. `finalize:<runId>`) |
| finishedAt | Date | TTL: keep 14 days |
Indexes:
- `{status:1, runAt:1}` (claim)
- `{status:1, lockedUntil:1}` (lease recovery)
- `{runId:1, status:1}` (cancel, delete)
- `{dedupeKey:1}` unique, partial filter `dedupeKey: {$type: 'string'}`
- `{finishedAt:1}` TTL with partial filter `status in [done, canceled]` (a `$in` partial filter needs MongoDB 6.0 or newer)

### `schedules`
| Field | Type | Notes |
|---|---|---|
| workspaceId, brandId | ObjectId | |
| label | string | shown in the UI, so two schedules on one brand can be told apart |
| frequency | `'daily'\|'weekly'\|'monthly'` | |
| hour, timezone | int 0–23, IANA string | runs at that local hour; weekly on `weekday`, monthly on `dayOfMonth` (capped at 28) |
| weekday, dayOfMonth | int \| null | |
| platforms | Platform[] | |
| promptSelection | `{ mode: 'all_active'\|'fixed', promptIds: ObjectId[] }` | |
| country, city, language, scope | | |
| isActive | bool | |
| nextRunAt, lastRunAt | Date | |
| lastRunId | ObjectId \| null | |
| consecutiveSkips | int | the schedule auto-pauses at 3 |
| pausedReason | `'user'\|'insufficient_credits'\|'brand_archived'\|null` | |
| inFlight | `{slot, until}` \| null | the slot a tick claimed and until when; a stale one is taken over (D-026) |
| lastSkip | `{at, reason: 'insufficient_credits'\|'no_prompts'\|'no_platforms'}` \| null | cleared by the next run |
Indexes: `{isActive:1, nextRunAt:1}`; `{workspaceId:1, brandId:1}`; `{'inFlight.until':1}` (partial, dates only).

## Money

### `credit_ledger` (append-only)
| Field | Type | Notes |
|---|---|---|
| workspaceId | ObjectId | |
| delta | int | positive is a grant, negative is a spend or reset |
| bucket | `'plan'\|'purchased'` | |
| reason | `'signup_bonus'\|'referral'\|'survey'\|'topup'\|'plan_grant'\|'plan_reset'\|'run_reserve'\|'run_refund'\|'admin_adjust'` | |
| refType, refId | string | e.g. `run`/`<runId>`, `stripe_invoice`/`in_…`, `stripe_session`/`cs_…` |
| balanceAfter | `{ plan, purchased }` | |
| note | string | human-readable description |
| actorUserId | ObjectId \| null | |
Indexes:
- `{workspaceId:1, createdAt:-1}`
- `{reason:1, bucket:1, refType:1, refId:1}` **unique** (idempotency: one grant per invoice, one refund per run per bucket, etc.)

### `provider_spend`
`{ date: 'YYYY-MM-DD' (UTC), provider, costMicros, calls }`, unique `{date:1, provider:1}`. Summed from every check (the answer's cost goes to the platform's provider, the extraction's to OpenAI). The worker holds a provider's jobs once today's total passes its cap (03, D-023). System data, no `workspaceId`.

### `stripe_events`
`{ eventId (unique), type, status: 'processing'|'done'|'failed', attempts, error, claimedAt, receivedAt, processedAt }`. A `processing` row whose `claimedAt` is over 5 minutes old is taken over (D-025).

## Other collections

### `shares`
`{ workspaceId, runId, tokenHash (unique), createdBy, expiresAt|null, revokedAt|null, lastViewedAt, viewCount }`

### `referrals`
`{ referrerWorkspaceId, referredUserId (unique), status: 'pending'|'credited'|'rejected', creditedAt }`. The credit is granted when the referred user verifies their email.

### `surveys`
`{ userId (unique), workspaceId, answers, creditedAt }`. `answers` follows `surveyAnswersSchema` (D-024). Keyed by user, so no workspace-scope plugin (D-025).

### `email_log`
`{ workspaceId|null, userId|null, template, to, idempotencyKey (unique), status: 'queued'|'sent'|'failed'|'suppressed', driver, resendId, error, attempts, sentAt, createdAt }`. Written when an email is queued, updated by the `send_email` job. Never holds the body (D-026). Indexes: `{idempotencyKey:1}` unique; `{workspaceId:1, createdAt:-1}`; `{userId:1, template:1, createdAt:-1}`.

## What v1 collections become
| v1 | v2 |
|---|---|
| users (credits, plan, stripe on the user) | users + workspaces + memberships |
| brands | brands (adds domain, aliases, competitors, categories) |
| reports (reportData blob, stats, progress, shareToken, competitorComparison) | runs + run_results + shares; competitor data is computed |
| promptsents, promptresponses | prompts + run_results + run_result_raw |
| scheduledprompts (copied prompt arrays) | schedules (references prompts) |
| creditlogs | credit_ledger |
| surveys | surveys |
