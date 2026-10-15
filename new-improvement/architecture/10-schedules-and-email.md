# 10: Schedules and email

## Schedule semantics

- A schedule belongs to one brand. A brand may have several schedules, told apart by `label`.
- **Timing:** `frequency` is daily, weekly (`weekday`) or monthly (`dayOfMonth`, which must be 1–28). Every schedule also has `hour` (0–23) and an IANA `timezone`, defaulting to the workspace timezone.
- **`nextRunAt`:** the next local occurrence of that slot, converted to UTC. It is computed with `@internationalized/date` or `luxon`. Unit tests must cover DST transitions.
- **Prompt selection:**
  - `all_active`: the brand's non-archived prompts at the moment the run starts. Prompts added later are picked up automatically.
  - `fixed`: an explicit `promptIds` list. Archived ids are skipped. If none remain, the run is skipped with reason `no_prompts`.
- **Platforms:** the platforms must be in the plan at run time. Any that aren't are dropped and the user is emailed once. If none remain, the run is skipped.

## Scheduler tick

The tick runs every 60 s on every instance and is idempotent.

```js
// claim one due schedule at a time (repeat until none)
const s = schedules.findOneAndUpdate(
  { isActive: true, nextRunAt: { $lte: now } },
  { $set: { nextRunAt: computeNext(s, now) /* from now, not from the missed slot */, lastRunAt: now } },
  { sort: { nextRunAt: 1 } })
```

This works with two instances because claiming and advancing `nextRunAt` happen in one update. Only one instance can win a given slot.

For each claimed schedule:
1. **Create the run** with `idempotencyKey = schedule:<id>:<slotISO>`. This is the same code path as `POST /runs`, with `trigger: 'scheduled'`. If the run already exists for that key, do nothing.
2. **Insufficient credits:**
   - Increment `consecutiveSkips`.
   - Send the email `run_skipped_low_credits`. Its idempotency key is the slot.
   - At 3 skips in a row, set `isActive = false` and `pausedReason = 'insufficient_credits'`, and send the email `schedule_paused`.
3. **Success:** reset `consecutiveSkips = 0` and set `lastRunId`.

**Downtime:** catch-up runs **once** and computes the next slot from now. It never replays every missed slot. This avoids a burst of charges after an outage.

**Brand archived:** all of the brand's schedules are paused with `pausedReason = 'brand_archived'`.

## Email (log driver by default, Resend optional: D-018)

- **Sending:** emails go through the `send_email` job type:
  - `payload {template, to, data, idempotencyKey}`
  - the `log` driver (default) writes the rendered email to the log and `email_log`; the `resend` driver (only when `RESEND_API_KEY` is set) calls the Resend API with the `Idempotency-Key` header
  - each send is logged in `email_log`
  - retries follow the queue policy
- **Sender:** `EMAIL_FROM` (e.g. `PromptVerse <noreply@<domain>>`). Using the `resend` driver needs a verified Resend domain with SPF and DKIM.
- **Templates:** typed TypeScript templates in `apps/server/src/emails/templates.ts`, rendered to HTML and a plain-text fallback from the same blocks (D-026 replaces React Email).
- **Recipients:** auth emails go to the user; `schedule_created`/`schedule_updated` to the user who made the change; everything else to the workspace owners, with `:<userId>` appended to the key so each owner's copy is its own `email_log` row.

| Template | Trigger | Idempotency key |
|---|---|---|
| `verify_email` | register, resend | `verify:<tokenId>` |
| `reset_password` | forgot password | `reset:<tokenId>` |
| `welcome` | first verification | `welcome:<userId>` |
| `schedule_created` | `POST /schedules` | `schedule_created:<scheduleId>` |
| `schedule_updated` | prompt selection, platforms or frequency changed (replaces v1 "prompt changed" mail) | `schedule_updated:<scheduleId>:<updatedAt>` |
| `scheduled_run_completed` | finalize of a scheduled run: headline metrics, delta vs previous run, link | `run_done:<runId>` |
| `run_skipped_low_credits` | scheduler skip | `skip:<scheduleId>:<slot>` |
| `schedule_paused` | 3 skips in a row | `paused:<scheduleId>:<date>` |
| `low_credits` | balance drops below 10% of the plan allowance (or below 10 credits), at most once per period | `low:<workspaceId>:<periodStart>` |
| `payment_failed` | `invoice.payment_failed` | `payfail:<invoiceId>` |
| `schedule_platforms_dropped` | a slot finds platforms the plan no longer includes (sent once per platform set) | `dropped:<scheduleId>:<platforms>` |

- **Opt-out:** users can opt out of non-essential emails (run completed, low credits) in settings. Auth and billing emails always send.
