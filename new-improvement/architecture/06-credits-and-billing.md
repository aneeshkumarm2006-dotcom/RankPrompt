# 06: Credits and billing

## Credit model

- **1 credit = 1 check** (prompt × platform), for manual and scheduled runs alike (D-006).
- **Two buckets** on the workspace (`workspaces.credits`):
  - **`plan`**: granted by the subscription. It is **reset** at each billing cycle and does not roll over. It is zeroed when the subscription ends.
  - **`purchased`**: top-ups, the signup bonus, referral rewards, survey rewards and admin grants. These **never expire**.
- **Spend order:** plan first, then purchased. The split is recorded on every reservation, so refunds go back to the right bucket.
- **Ledger:** every balance change is an atomic `$inc` on the workspace **plus** a `credit_ledger` insert, inside the same transaction. Each ledger row has a unique key `(reason, bucket, refType, refId)`, so a retried operation is ignored instead of being applied twice.
- **Nightly reconciliation job:** for each workspace, the sum of its ledger deltas per bucket must equal `workspaces.credits`. A mismatch sends a Sentry alert and is never auto-fixed.

## Grants and spends

| Event | Bucket | Amount | Ledger reason, ref |
|---|---|---|---|
| Signup | purchased | 50 | `signup_bonus`, `user/<userId>` |
| Referred user verifies email | purchased (referrer) | 10 | `referral`, `user/<referredUserId>` |
| Survey completed (once per user) | purchased | 50 | `survey`, `user/<userId>` |
| Top-up paid | purchased | 50 / 100 / 200 | `topup`, `stripe_session/<cs_id>` |
| Subscription invoice paid that opens a new billing period (D-025) | plan | set to the tier allowance | `plan_reset` (−old balance) + `plan_grant` (+allowance), `stripe_invoice/<in_id>` |
| Upgrade mid-cycle (same period, higher allowance) | plan | top up to the new allowance (never decrease) | `plan_grant`, `stripe_invoice/<in_id>` (the proration invoice) |
| Subscription ended | plan | → 0 | `plan_reset`, `stripe_sub_end/<sub_id>` |
| Run created | plan first, then purchased | −cost | `run_reserve`, `run/<runId>` |
| Run finalized with failed or canceled checks | the same buckets as reserved | + refund | `run_refund`, `run/<runId>` |
| Admin adjustment | either | ± | `admin_adjust`, `admin/<uuid>` (script only) |

## Plans (`packages/shared/src/plans.ts`, served by `GET /plans`)

Starting values are copied from v1. Q-003 and Q-001 decide the final numbers.

| Tier | Price (display) | Monthly plan credits | Brands | Max prompts per run | Platforms | Schedules |
|---|---|---|---|---|---|---|
| free | $0 | 0 (50 signup credits instead) | 1 | 25 | all 5 (Q-001) | weekly/monthly only |
| starter | $99/mo | 150 | 1 | 50 | all 5 (Q-001) | all |
| pro | $149/mo | 500 | 3 | 150 | all 5 | all |
| agency | $249/mo | 1000 | 20 (Q-003: v1 UI said 5) | 150 | all 5 | all |

| Top-up | Credits | Price (display) |
|---|---|---|
| topup_50 | 50 | $20 |
| topup_100 | 100 | $40 |
| topup_200 | 200 | $80 |

- **Price ids** come from env (`STRIPE_PRICE_STARTER`, …). Display prices are only cosmetic; **Stripe is the source of truth for what is charged.**
- The web app never hardcodes plans. Pricing, BuyCredits and the brand-limit modals all read `GET /plans`.

## Stripe integration

### Setup
- Pin the Stripe API version in the SDK constructor to the current version at build time. Use the same version on the webhook endpoint.
- Each workspace has **exactly one Stripe customer**, created lazily at the first checkout and stored in `workspaces.stripe.customerId`. Checkout always passes `customer` (never `customer_email`), so no duplicate customers are created.
- Metadata on the customer, subscription and checkout session: `{ workspaceId }`. This is only a hint; the handlers look the workspace up by `customerId`.

### Endpoints
- **`POST /billing/checkout {tier}`:**
  - Rejected if the workspace already has an active subscription. The response points the user to the portal to change plan.
  - Otherwise creates a subscription-mode Checkout Session.
- **`POST /billing/topup {pack}`:** a payment-mode session with `metadata {workspaceId, pack, credits}`.
- **`POST /billing/portal`:** opens the Customer Portal.
  - It allows plan switching between our prices, cancellation at period end, and payment method updates.
  - Configure **downgrades to take effect at period end** and upgrades immediately with proration.
- **`GET /billing/subscription`:** returns the workspace plan state (tier, status, period end, `cancelAtPeriodEnd`, `pendingTier`).
- **`POST /api/stripe/webhook`** (same path as v1, D-018):
  - Takes a raw body and verifies the signature.
  - Is mounted **before** `express.json()`.
  - Is exempt from the general rate limiter.

### Webhook processing (idempotent)
```
1. verify signature → event
2. insert stripe_events {eventId, status:'processing'}; on duplicate key: if status 'done' → 200; if 'processing' and < 5 min old → 409, so Stripe retries later (D-025); else take over
3. handle (below) — handlers re-fetch the subscription/invoice from Stripe instead of trusting event payload ordering
4. mark 'done' → 200.  On error: mark 'failed' + attempts++ → respond 500 so Stripe retries
```

| Event | Handling |
|---|---|
| `checkout.session.completed` (mode `payment`, `payment_status = 'paid'`) | Grant the top-up credits (purchased bucket; ledger reason `topup` with the session id makes it idempotent). |
| `checkout.session.completed` (mode `subscription`) | Store `customerId` and `subscriptionId`. Credits are **not** granted here (invoice.paid does that). |
| `invoice.paid` (or v1's `invoice.payment_succeeded`) | Re-fetch the subscription. Tier comes from the price id. Set the plan state. If the subscription's current period is newer than the last reset, **reset** plan credits to the allowance; in the same period with a higher allowance (an upgrade), **raise** them to it; otherwise nothing (D-025). Rows under the invoice id. |
| `customer.subscription.updated` | Re-fetch. Sync `status`, `currentPeriodEnd`, `cancelAtPeriodEnd`, tier from the price, and `pendingTier` (scheduled downgrade). Never grants credits; a re-fetched subscription that has ended is handled like `deleted` (D-025). |
| `customer.subscription.deleted` | Tier becomes `free` and status `canceled`. **Plan credits go to 0. Purchased credits are kept.** |
| `invoice.payment_failed` | Status becomes `past_due` and the user is emailed. Runs are still allowed while plan credits remain. |

Notes:
- **Newer Stripe API versions:** the subscription id on an invoice is under `invoice.parent.subscription_details.subscription`. Read it through one helper so the code doesn't depend on the version.
- **Statuses:** Stripe values outside our enum (`incomplete`, `trialing`, `unpaid`, `paused`) are mapped explicitly in `mapStripeStatus()`. v1 stored invalid enum values that later broke `save()`.

### Test matrix (P6 exit)
Replay these locally with the Stripe CLI or signed test events:
- duplicate delivery of every event
- events delivered out of order (`subscription.updated` before `checkout.session.completed`)
- failed payment, then recovery
- upgrade mid-cycle
- downgrade at period end
- cancel at period end, then period end reached
- top-up during an active subscription
- refund of a top-up (manual admin adjust; documented, not automated)

After each scenario, check that ledger = balance.

## Referral and survey rules
- **Referrals:**
  - The referral code belongs to the workspace.
  - `?ref=CODE` on register is stored as a pending `referrals` row.
  - The +10 credits go to the referrer only when the referred user **verifies their email**.
  - Self-referral (same workspace) and duplicate referred users (unique `referredUserId`) are rejected.
  - The referrer sees counts only, never the referred users' emails.
- **Survey:**
  - Once per user (unique `userId`).
  - The answers are validated by a zod schema.
  - The credit grant is in the same transaction as the survey insert.
