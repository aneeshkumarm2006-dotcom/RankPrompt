# Context

## The product

**PromptVerse** is an AI-search visibility tool ("AI Search Optimization" / AEO). A user adds a brand (a name and a website). We generate realistic, unbranded questions that a buyer might ask an AI assistant, such as "best immigration consultants in Toronto". We put those questions to several AI assistants and report:
- whether the brand is **mentioned**
- where it **ranks** among the companies the answer recommends
- whether its website is **cited**
- how it compares with its **competitors**

We track this over time with scheduled re-runs.

**Current stage: single-user beta.** The owner is the only user. v2 is about the code: finish the features, clean up the architecture and remove n8n. It reuses the existing Render, Vercel, Atlas, Stripe and API keys, with no new accounts, no staging and no DNS changes. All work lands on `main` (D-018).

Money: users pay in **credits**, through Stripe subscriptions (monthly credits) and one-off top-ups. A free signup bonus, referrals and a survey also grant credits.

The longer-term direction is a **B2B agency / white-label** product: agencies manage many client brands under their own branding. The PRD and mockups are in `D:\Completed Sites - Davnoot\promptverse screens\`. v2 does not build this yet, but its data model is workspace-based so it can be added without a migration (see D-005).

## Why we're rebuilding

v1 is vibe-coded and depends on **n8n** running on a Hostinger VPS (`n8n.srv883399.hstgr.cloud`). n8n does the actual work:
- brand summary
- asking each AI platform every prompt
- scoring
- competitor comparison
- the scheduled-run cron
- emails

In v1, the browser calls n8n directly for every prompt, then posts the raw results to our API along with a **credit count the browser chooses itself**. Beyond that, the [v1 audit](reference/current-system-audit.md) found:
- Credit updates aren't atomic.
- The Stripe webhook isn't idempotent, and cancelling wipes purchased credits.
- n8n endpoints are wide open when `N8N_API_KEY` is unset.
- Any user can read other users' schedules.
- The favicon fetch is open to SSRF.
- Tokens are stored in localStorage.
- Google AI Overviews has 3 different spellings, and "visible" has 3 different definitions.
- Several page files are 1,100–1,250 lines long.

All current data is demo data, so we can drop the database.

**Outcome we want:** a correct, maintainable TypeScript app.
- Everything runs inside our own backend; n8n is retired.
- An in-house analysis engine covers **ChatGPT, Perplexity, Gemini, Claude and Google AI Overviews**.
- The database is redesigned around workspaces.
- Credits, billing and schedules are correct by construction.
- The UI keeps the current look and feel. This is a rebuild of the architecture and logic, not a redesign.

## v1 snapshot (what exists today)

| Part | v1 |
|---|---|
| Frontend | React 19 + Vite + Tailwind (JS), Vercel. About 11k lines |
| Backend | Express 4 + Mongoose 8 (JS, ESM), Render |
| DB | MongoDB Atlas, database `promptverse` (demo data) |
| Background work | n8n on Hostinger (to be retired) |
| AI | OpenAI (category and prompt generation). The platform querying happens inside n8n |
| Payments | Stripe: Starter/Pro/Agency subscriptions and 50/100/200-credit top-ups (**live keys** in the local `.env`) |
| Auth | Email/password + Google (google-auth-library). The Supabase client is initialised but never used |

There is also a proven pipeline outside the app: standalone "luna" scripts that ran ChatGPT, Perplexity and Gemini checks directly and saved them as reports. The v2 engine is based on them. See [reference/luna-prototype.md](reference/luna-prototype.md).

## Target (v2) in one paragraph

v2 is a pnpm TypeScript monorepo:
- `apps/server`: Express 5 + Mongoose, on Render. It runs the API, the job worker and the scheduler in one process on the existing Render service.
- `apps/web`: React 19 + Vite + TanStack Query, on Vercel.
- `packages/shared`: zod API contract, enums, plans, metric definitions.
- `packages/engine`: platform adapters, extraction, matching, plus a CLI.

The web app calls `/api` on its own origin (Vercel rewrites it to Render, D-018), so auth uses first-party httpOnly `SameSite=Lax` cookies. A run is a set of **checks** (prompt × platform). They run as jobs in a MongoDB-backed queue, with atomic claims, leases, retries and an idempotent finalize step. Credits are reserved up front and failed checks are refunded. Emails go through an email job (a log driver by default, Resend when a key is set).

## Hard constraints

- **No n8n, anywhere.** No webhooks out to automation tools for core logic.
- **Hosting stays the same:** the existing Vercel project and Render service, reconfigured at go-live. No new accounts, no staging, no DNS changes, no Redis (D-018).
- **All work is on `main`.** v2 lives in `apps/` and `packages/` next to v1, and must not break the live v1 builds.
- **Keep the current visual design.** Port the existing Tailwind markup.
- **TypeScript strict everywhere.** The API contract is shared zod schemas.
- **Workspace isolation is enforced in the data layer**, not left to each route.
- **Metrics are defined once** (`packages/shared/metrics.ts`). The UI only displays numbers the server computed.
- **Production DB access is done by the user.** Agents in auto mode get blocked on prod reads and writes. Prepare scripts and hand the user the exact command.

## Glossary

| Term | Meaning |
|---|---|
| **Workspace** | The owner of all data: brands, runs, credits, plan, Stripe customer. Each user gets a personal workspace now. Agencies will have teams later. |
| **Membership** | Links a user to a workspace, with a role (`owner` for now). |
| **Brand** | The company being tracked: name, domain, aliases, competitors, default country and language. |
| **Category** | A topic bucket for prompts, such as "Immigration Consulting". Generated by the LLM, or added by the user. |
| **Prompt** | An unbranded question in a brand's **prompt library**. Its text never changes: editing archives the old prompt and creates a new one. |
| **Platform** | One of `chatgpt`, `perplexity`, `gemini`, `claude`, `google_aio`. These are the **only** spellings. |
| **Run** | One execution of N prompts × M platforms for a brand. Manual or scheduled. Used to be called a "report". |
| **Check** | One prompt on one platform within a run. This is the unit of work and of billing (1 credit). |
| **Result** | The stored outcome of a check (`run_results` doc). Status is `ok`, `no_answer` or `failed`. |
| **Answered** | A check with status `ok`. Only answered checks count in metric denominators. |
| **no_answer** | The platform returned nothing to evaluate, for example no AI Overview was shown for that query. Not a failure. Excluded from metrics except AI Overview presence. |
| **Vendors** | The ordered list of companies an answer recommends, extracted by the shared extractor. |
| **Mentioned** | The brand name or an alias appears as a whole word in the answer (with citations stripped), or the brand appears in the vendor list. |
| **Visible / Visibility %** | Mentioned ÷ answered checks. This is the **only** meaning of "visible". |
| **Rank** | The brand's 1-based position in the vendor list. Empty if the brand isn't there. |
| **Cited** | A citation's domain equals the brand's domain or is a subdomain of it. |
| **Competitor** | A brand the user tracks alongside their own, with name, domain and aliases. It uses the same matching as the brand. |
| **Suggested competitor** | A vendor that is often recommended but not tracked yet. |
| **Share** | A revocable public link to one run's report. |
| **Schedule** | Re-runs a brand's prompts daily, weekly or monthly. |
| **Credit** | 1 credit = 1 check. Credits come in two buckets: **plan** (reset monthly) and **purchased** (top-ups, signup, referral and survey grants; never expire). |
| **engineVersion** | The version of the adapter, extractor and matcher code that produced a result. Stored so old runs stay explainable. |
