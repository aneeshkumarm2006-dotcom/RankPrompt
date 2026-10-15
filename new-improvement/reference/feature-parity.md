# Feature parity: v1 → v2

Every v1 feature is listed with its v2 home. P5 is complete only when every row marked **keep**, **fix**, or **new** has been checked off on a local copy (no staging, D-018). A row is checked only after a person has tested it end to end.

Statuses:
- **keep**: same behavior, new code.
- **fix**: kept, with the v1 bug or gap fixed.
- **replace**: the behavior changes by design.
- **new**: did not exist in v1.
- **drop**: removed.
- **defer**: postponed to after v2.

| ID | v1 feature (where) | Status | v2 home | Notes |
|---|---|---|---|---|
| F-01 | Landing page: Hero, Features, HowItWorks, Pricing, CTA, Footer (`pages/Landing.jsx`, `components/*`) | keep | `web/features/landing` | Pricing comes from `GET /plans`. Remove false claims such as "30-day money-back" unless confirmed. |
| F-02 | Email/password register and login (`Login.jsx`, `Register.jsx`, `authController`) | fix | `auth` module + `web/features/auth` | Cookie sessions. Adds email verification and password reset. Generic error for unknown email or wrong provider. |
| F-03 | Google sign-in (`@react-oauth/google`, `googleAuth`) | fix | `auth` | Require `email_verified`. Link `googleId` to an existing account explicitly. |
| F-04 | Referral code and `?ref=` on register (`creditController.getReferralInfo`) | fix | `referrals` module + `web/features/credits` | Credit is granted only after the referred user verifies their email. No self-referral. Referrer no longer sees referred users' emails. |
| F-05 | 50-credit signup bonus | keep | `auth` → `credits` ledger (`purchased` bucket, reason `signup_bonus`) | |
| F-06 | Report wizard step 1: brand, URL, local/national scope, city, country, language, platforms (`Reports.jsx`) | replace | Brand create flow plus the run config form | 38 countries and 18 languages carried over from `Reports.jsx:144-189`. Platforms are checked against the plan. |
| F-07 | Brand summary (n8n `N8N_OPENAI`) | replace | `POST /brands/analyze` (in-house, OpenAI web search) | |
| F-08 | 10 categories plus custom categories (`openaiController.generateCategories`, `Step2BrandAnalysis`) | keep | `POST /brands/analyze` returns categories, stored on the brand | Max 10 categories. |
| F-09 | Prompt generation (1/10/25), custom prompts up to 25, inline edit (`Step3ReadyToAnalyze`) | fix | `POST /brands/:id/prompts/generate` + prompt library | Uses one structured-output call. Generated prompts are saved, so resume never regenerates them. Fixes the `localSearchCity` bug. |
| F-10 | Save in-progress report and resume via `?continue=` (`save-progress`) | replace | A brand with saved prompts and no run is the resumable state | Drafts are no longer a fake "report". |
| F-11 | Run analysis with progress modal (browser fans out to n8n) | replace | `POST /runs` + `/app/runs/:id` progress page (polling) | Runs server-side. Survives reload and tab close. |
| F-12 | Low-credits modal (≤10) and insufficient-credits modal | fix | `POST /runs/estimate` + modals | Cost = prompts × platforms everywhere. |
| F-13 | Report view: stats, platform chart, category chart, results table with filters, snippet modal, AI answer modal (`ReportView.jsx`) | fix | `web/features/reports` `ReportView` | Uses server aggregates and the D-012 metrics. Shows citations, vendor list and competitor ranks per check. Missing rank shows "—", never `#undefined` or 0. |
| F-14 | Share link (`POST /reports/:id/share`) | fix | `shares` module | Revocable and can expire. Public payload is stripped down. `noindex`. |
| F-15 | Public shared report page (`SharedReport.jsx`) | fix | Same `ReportView` with `readOnly` | No more duplicated code that drifts. |
| F-16 | PDF export (`utils/pdfGenerator.js`) | fix | `web/features/reports/pdf` | Fix the row-count note and use the "PromptVerse" name. Remove dead `generateReportPDFFromHTML`. |
| F-17 | All reports list: in-progress and completed, delete, share (`AllReports.jsx`) | replace | Runs list (all brands) | Shows status, platforms, visibility and date. Shows queued and running runs live. |
| F-18 | My Brands: list, limit info, delete, edit (broken: no route), prompt editor (lossy) (`MyBrands.jsx`) | fix | `web/features/brands` | Editing works (`PATCH /brands/:id`). Prompts are edited only in the prompt library. Delete archives the brand and disables its schedules. |
| F-19 | Brand dashboard performance summary: category visibility, platform scores, ranked and missed prompts, top sources (`PerformanceSummary.jsx`) | fix | `GET /brands/:id/insights/overview` + dashboard tabs | The category, platform and time filters actually apply. Removes hardcoded "1 active schedule". |
| F-20 | Visibility trend chart with date range (`/visibility-trend`) | fix | `GET /brands/:id/insights/trend` | Per platform plus total. Marks runs whose prompt set or platforms changed. |
| F-21 | Competitor comparison, max 3, via n8n (`PerformanceSummary` tab) | replace | Brand competitors + `GET /brands/:id/insights/competitors` | All tracked competitors, per-prompt ranks, share of voice, suggested competitors. No external call. |
| F-22 | All prompts page: prompt × report history (`AllPrompts.jsx`) | fix | `web/features/prompts` + `GET /brands/:id/insights/prompts` | Real manual/scheduled flag. Rank means the AI rank, not the row number. |
| F-23 | Brand reports list (`BrandReports.jsx`) | keep | Brand runs tab | The filter is labelled correctly. |
| F-24 | Citations and sources page (v1 shows only the brand's own matched URLs) (`CitationsAndSources.jsx`) | fix | `GET /brands/:id/insights/sources` | Real cited domains and URLs per platform, with share of citations. |
| F-25 | Scheduled reports: create from report, pause/resume, delete, frequency, models, edit/add/delete prompt, credits banner (`BrandScheduledReports.jsx`) | fix | `schedules` module + `web/features/schedules` | `promptSelection` is all-active or fixed. Hour and timezone. Cost preview. Several schedules per brand are told apart by label. |
| F-26 | Emails on schedule creation and prompt change (n8n mail webhooks) | replace | Resend jobs | See [10-schedules-and-email](../architecture/10-schedules-and-email.md). |
| F-27 | Scheduled execution (n8n cron + `/prompts-due` + `/n8n-save-report`) | replace | In-house scheduler + queue | Skips and emails when credits are low. Pauses after 3 skips in a row. |
| F-28 | Profile: name, email, plan, credits, credit activity, billing portal, change password (`Profile.jsx`) | fix | `web/features/settings` + `GET /credits/ledger` | Removes mock trial data. Shows plan credits and purchased credits separately. |
| F-29 | Buy credits: plans and top-ups (`BuyCredits.jsx`, hardcoded prices) | fix | `web/features/billing` | Data comes from `GET /plans`. Reads `?checkout=success`. |
| F-30 | Stripe subscription, top-up, portal, webhooks | fix | `billing` module | Idempotent. Credits reset on renewal. Cancelling keeps purchased credits. See 06. |
| F-31 | Earn credits: referral link and survey (+50) (`EarnCredits.jsx`, `SurveyModal.jsx`) | keep | `web/features/credits` | Restores the sidebar link (commented out in v1). |
| F-32 | Dark mode and theme toggle (`ThemeContext`) | keep | `web/app/theme` | |
| F-33 | Promo popup 15 s after a report is created, links to `davnoot.com/contact` (`PromoPopup.jsx`, `App.jsx`) | keep | `web/features/promo` | Triggered by run creation through a small event or store, not by polling sessionStorage. |
| F-34 | Vercel Analytics | keep | `web/main.tsx` | |
| F-35 | Sidebar with credits and plan | fix | `web/app/layout` | Data from the `GET /me` + workspace query. Correct right after login (v1 showed 0). |
| F-36 | Brand limits per plan (`BRAND_LIMITS`) | keep | `packages/shared/plans.ts` | Q-003: agency limit is 20 or 5. |
| F-37 | Allowed platforms per plan (`allowedModels`) | keep | `packages/shared/plans.ts` | Q-001. |
| F-38 | Admin role (exists in v1 but unused) | defer | Admin scripts in `apps/server/scripts` | Scripts: adjust credits, re-run failed checks, inspect a run. |
| F-39 | XLSX export (done by hand with luna scripts) | new | `GET /runs/:id/export.xlsx` + engine CLI | |
| F-40 | Engine CLI for ad-hoc client projects | new | `packages/engine` CLI | Replaces the throwaway scratchpad scripts. |
| F-41 | Run cancel | new | `POST /runs/:id/cancel` | Refunds checks that hadn't run yet. |
| F-42 | Suggested competitors | new | Insights competitors tab | Vendors that are often recommended but not tracked. |
| F-43 | `AnalysisProgressModal`, `Dashboard.jsx`, `SaveBrandModal`, "Existing brand" modal, `/stripe/sync-subscription` client call | drop | — | Dead code in v1. |
| F-44 | Supabase client | drop | — | Never used. |
| F-45 | Team members, white-label, client portfolio (PRD) | defer | — | The workspace model is ready (D-005). |
| F-46 | Sidebar "Soon" items in BrandSidebar | drop | — | Removes routes that don't exist. |
