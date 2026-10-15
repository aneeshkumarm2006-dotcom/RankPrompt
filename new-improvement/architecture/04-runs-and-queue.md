# 04: Runs and the job queue

Rule zero: **assume at least two server instances are running at all times.** Render deploys overlap the old and new instances, and we may scale out later. That means:
- Every state change is a conditional, atomic Mongo update.
- Nothing is kept only in memory.

## Run lifecycle

```
POST /runs ──► queued ──(first check claimed)──► running ──(all checks terminal)──► finalizing ──► completed | partial | failed
                 │                                   │
                 └──────────── POST /runs/:id/cancel ┴──► canceled (pending checks canceled + refunded)
```
- **completed:** every check ended `ok` or `no_answer`.
- **partial:** at least one `ok`, and at least one `failed`.
- **failed:** no `ok` checks at all, for example a provider outage. All failed checks are refunded.

## Creating a run (`runs.service.create`)

This is one Mongo **transaction** (`session.withTransaction`).

1. **Validate.**
   - The brand belongs to the workspace and isn't archived.
   - The platforms are allowed by the plan.
   - The prompt count is within the plan's cap.
   - The prompts belong to the brand and are active.
2. **Idempotency.** Look up `runs {workspaceId, idempotencyKey}`. If a run exists, return it unchanged (HTTP 200, not 201).
3. **Cost.** `cost = prompts × platforms` (D-006).
4. **Reserve credits.** Plan credits are spent first.
   ```js
   // compute split: fromPlan = min(cost, ws.credits.plan); fromPurchased = cost - fromPlan
   workspaces.updateOne(
     { _id, 'credits.plan': { $gte: fromPlan }, 'credits.purchased': { $gte: fromPurchased } },
     { $inc: { 'credits.plan': -fromPlan, 'credits.purchased': -fromPurchased } })
   // modifiedCount === 0 → throw INSUFFICIENT_CREDITS (402) — transaction aborts
   ```
   Insert ledger rows `run_reserve` (one per bucket used), with `refId = runId`.
5. **Insert** the `runs` doc, with a frozen `brandSnapshot` and `config`.
6. **Insert** `run_results` (status `pending`), one per prompt × platform.
7. **Insert** `jobs` of type `check`, one per result, with `payload {resultId}`, `providerKey`, `workspaceId`, `runAt: now`.
8. Commit, then return `201 {run}`.

## Queue mechanics (`apps/server/src/jobs/queue.ts`)

### Claim
```js
jobs.findOneAndUpdate(
  { status: 'queued', runAt: { $lte: now }, type: { $in: handledTypes },
    providerKey: { $nin: saturatedProviders }, workspaceId: { $nin: saturatedWorkspaces } },
  { $set: { status: 'running', leaseId: new ObjectId(), lockedBy: instanceId,
            lockedUntil: now + 60s }, $inc: { attempts: 1 } },
  { sort: { runAt: 1 }, returnDocument: 'after' })
```
- **Saturation lists** come from in-process limiters:
  - **Provider:** concurrency plus a requests-per-minute token bucket.
  - **Workspace:** an in-flight cap, `MAX_INFLIGHT_PER_WORKSPACE`, default 64 (an upper bound only).
  - **Fair shares (D-027):** when several workspaces have due jobs for the same provider (read every 2 s with one small aggregate), only the ones with the fewest of that provider's jobs in flight on this instance may claim the next one; the others' `(workspaceId, providerKey)` pairs go into a `$nor` in the claim filter. Claims are oldest-first, so without this the oldest run takes every slot and RPM token of a slow provider and the other runs wait for it. A workspace alone on a provider may use all of it.
- Saturated providers, workspaces and pairs are excluded from the claim filter, so one large run can't starve other customers.
- **Limits are per instance.** During a deploy overlap the totals can briefly double. Provider 429 handling, described next, absorbs this.

### Lease renewal and fencing
- While a handler runs, renew the lease every 15 s:
  `updateOne({_id, leaseId}, {$set:{lockedUntil: now+60s}})`.
  If `modifiedCount === 0`, the lease was lost: abort the handler and **do not write anything**.
- **All result writes are fenced.**
  - The job is completed with `jobs.updateOne({_id, leaseId}, {$set:{status:'done', finishedAt}})`.
  - The result is written with `run_results.updateOne({_id: resultId, status: {$in:['pending','running']}}, {...})`, only after re-checking that the job still holds the lease.
- **The result is fenced too (D-023).** Taking a check writes the job's `leaseId` onto the result (`pending|running → running`), and the outcome is written only where `{status: 'running', leaseId}` still match. A worker that lost its lease can't write, even one that re-checked the job a moment earlier.
- **Double execution.** If two workers end up running the same check after a lease expires, the provider is paid twice, but the stored result and the progress count are written only once, by the newest lease.

### Retry policy (by `ProviderError.kind`)
| kind | Action |
|---|---|
| `rate_limited` | Re-queue with `runAt = now + max(retryAfter, backoff)`. This doesn't count as an attempt if `retryAfter` was given. It also tells the provider limiter to slow down (AIMD: halve the rate, at most once per 2 s so a burst of 429s counts once, then recover slowly). |
| `transient` | Re-queue with exponential backoff (5 s, 15 s, 45 s, 2 m, 5 m) plus jitter, up to `maxAttempts` (5). |
| `quota` | Pause the provider for 15 min, re-queue without counting an attempt, and alert in Sentry. |
| `refused`, `bad_request` | Terminal: the check becomes `failed`. |
| extraction failure after 2 internal retries | Terminal: the check becomes `failed` (`extract_failed`). |
When `maxAttempts` is exhausted, the check becomes `failed` with the last error. An exception that isn't a `ProviderError` (a bug, a DB blip) retries with the `transient` backoff and, on the last attempt, fails the check with code `internal`.

### Lease recovery (sweeper)
Every 60 s, jobs with `status:'running', lockedUntil < now` are set back to `queued`, with `runAt: now` and the lease cleared. The attempt counter has already been incremented by the claim, which bounds a poison job.

### Graceful shutdown (SIGTERM)
1. Stop claiming new jobs.
2. Let in-flight handlers finish, up to `SHUTDOWN_GRACE_MS` (default 50 s; set Render `maxShutdownDelaySeconds` to 60).
3. Release unfinished jobs: `status: queued`, `attempts - 1`, `runAt: now`.

## Check handler (`handlers/check.ts`)

1. Load the result, run, workspace config and brand snapshot. If the run is `canceled`, mark the result `canceled` and finish.
2. On the first check of a run: `runs.updateOne({_id, status:'queued'}, {$set:{status:'running', startedAt}})`.
3. Mark the result `running`. Call `engine.ask` → `clean` → `extract` → `match`.
4. Write the result (fenced) with status `ok`, or `no_answer`, or `failed` on a terminal error.
5. Write `run_result_raw`. Add the cost to `provider_spend`.
6. **Last-check detection.** Count the remaining non-terminal results for the run, using the index `{runId, status}`. If none remain, enqueue `finalize_run` with `dedupeKey: finalize:<runId>`. The unique index makes duplicates impossible.

## Progress (for `GET /runs/:id`)
Progress is computed on read, never incremented:
```js
run_results.aggregate([{ $match: { runId } }, { $group: { _id: '$status', n: { $sum: 1 } } }])
```
A run has at most about 750 results (150 prompts × 5 platforms), so with the index this query is cheap. The frontend polls every 2 s while the status is `queued`, `running` or `finalizing`, then stops.

## Finalize (`handlers/finalizeRun.ts`) — idempotent

1. **Claim.** If this generation is already finalized (`finalizedGen ≥ generation`), exit. If any check is still open (a canceled run's in-flight checks), re-queue in 10 s without using an attempt. Otherwise `runs.updateOne({_id, status: {$in:['queued','running']}}, {$set:{status:'finalizing'}})`; a canceled run keeps its status.
   - A run that is already `finalizing`, for example after a crash, is resumed by the sweeper, which re-enqueues finalize. This handler accepts `finalizing` as a starting state.
2. **Compute** `counts`, `aggregates` (see 05) and `costMicros` from `run_results`.
3. **Refund** `reserved − charged − already refunded` (charged = `ok` + `no_answer`), in one transaction with step 4, conditional on `finalizedGen < generation`.
   - Purchased credits are refunded first, because those were spent last; no bucket gets back more than it gave.
   - The ledger rows `run_refund` have the unique key `(run_refund, bucket, run, runId)` (`runId:<generation>` after an admin rerun), so a second finalize can't refund twice.
4. **Set the final status** (`completed` if nothing failed, `partial` if something failed and at least one check is `ok`, else `failed`; `canceled` stays), `finishedAt`, `finalizedGen` and `credits.charged/refunded`.
5. **Scheduled runs only:** enqueue `send_email` (run summary) and update `schedules.lastRunId`.

## Sweeper (every 60 s, on every instance; everything it does is idempotent)
- Recover expired job leases (see above).
- Runs `running` or `finalizing` that have no non-terminal results and haven't been updated for 2 minutes: enqueue `finalize_run` (the dedupe key protects against duplicates).
- Runs stuck `queued` for over 30 minutes with no claimable jobs: log to Sentry.
- `send_email` jobs are retried by the normal queue retry policy.

## Cancel (`POST /runs/:id/cancel`)
1. Conditionally set the run to `canceled` (only from `queued` or `running`).
2. Set `jobs` for that run with `status: queued` to `canceled`, and the checks of every canceled job to `canceled` (including one a dead worker left `running`). Canceling a canceled run is a no-op; a finished run gives 409.
3. Running checks finish normally and their results are kept.
4. Enqueue `finalize_run`. Its refund covers the canceled checks; finalize keeps the `canceled` status.

## Delete (`DELETE /runs/:id`)
- Only allowed in a final status.
- Deletes the run, its results, raw payloads and shares.
- Ledger rows are kept: they are history.

## Throughput targets (P8 load test, `pnpm loadtest`)
- **One run of 150 prompts × 5 platforms** (750 checks) finishes in about 6 minutes. Perplexity is the slowest, at about 45 RPM, roughly 3.5 minutes. *Measured (8.1): 3.5 minutes.*
- **Three such runs at the same time:** fair shares keep each of them progressing, and no customer's run waits for another to finish. The provider RPM limits set a floor: 450 Perplexity checks at 45 RPM take 10 minutes, and Claude's 450 at 50 RPM take 9, so three full runs can't all finish in under ~10 minutes on one instance whatever the queue does. *Measured (8.1): 10.0, 10.9 and 11.6 minutes; when the first finished the others were 98% and 94% done (D-027).*
