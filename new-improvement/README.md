# new-improvement: the PromptVerse v2 rebuild

This folder holds the plan for rebuilding PromptVerse (repo `RankPrompt`) as a clean TypeScript app with **no n8n**. Everything n8n did (asking the AI platforms, scoring, competitor comparison, scheduled runs, emails) moves into our own backend.

It is the single source of truth for v2. When the code and these docs disagree, fix whichever one is wrong, in the same PR.

## Reading order

1. [CONTEXT.md](CONTEXT.md): what the product is, why we're rebuilding, glossary. **Read first.**
2. [DECISIONS.md](DECISIONS.md): every architectural decision, with the reason behind it, plus open questions.
3. [TODO.md](TODO.md): the step-by-step build order (stages 0–9), with owners: what you do and what Claude does. **Use this day to day.**
   [CHECKLIST.md](CHECKLIST.md) holds the detailed tasks and the **exit criteria** for each stage (P0–P9).
4. `architecture/`: how v2 works.

   | Doc | Covers |
   |---|---|
   | [01-system-overview](architecture/01-system-overview.md) | Topology, monorepo layout, modules, flows |
   | [02-data-model](architecture/02-data-model.md) | Every collection, field and index |
   | [03-analysis-engine](architecture/03-analysis-engine.md) | Platform adapters, extraction, matching |
   | [04-runs-and-queue](architecture/04-runs-and-queue.md) | Mongo job queue, worker, finalize, recovery |
   | [05-metrics](architecture/05-metrics.md) | The one set of metric definitions |
   | [06-credits-and-billing](architecture/06-credits-and-billing.md) | Ledger, buckets, Stripe |
   | [07-auth-and-security](architecture/07-auth-and-security.md) | Sessions, cookies, isolation, hardening |
   | [08-api-contract](architecture/08-api-contract.md) | Endpoint list |
   | [09-frontend](architecture/09-frontend.md) | Routes, feature folders, data layer |
   | [10-schedules-and-email](architecture/10-schedules-and-email.md) | Scheduler, Resend emails |

5. `ops/`: [env-vars](ops/env-vars.md), [deployment](ops/deployment.md), [cutover](ops/cutover.md).
6. `reference/`: background material.
   - [current-system-audit](reference/current-system-audit.md): what v1 got wrong, so we don't repeat it.
   - [luna-prototype](reference/luna-prototype.md): proven provider-call and scoring code from the standalone scripts.
   - [feature-parity](reference/feature-parity.md): every v1 feature and where it lives in v2.

## How to use the checklist

- Work phase by phase. A phase is done only when its **exit criteria** are met, not just when its boxes are ticked.
- Tick a box (`- [x]`) in the same PR that completes the task.
- If you change a decision, add a new dated entry to DECISIONS.md rather than editing the old one, then update the affected architecture doc.
- New work you discover goes into CHECKLIST.md under the right phase before you start it.

## Status

| Phase | State |
|---|---|
| P0 Docs | Done: approved 2026-10-14 (D-017); scope set to a single-user beta on `main` (D-018) |
| P1 to P9 | Not started |

The old `backend/` and `frontend/` folders are **v1 reference only**: don't extend them. v2 is built in `apps/` and `packages/` on `main`, with no new accounts or staging (D-018). The old folders are deleted at go-live (P9).
