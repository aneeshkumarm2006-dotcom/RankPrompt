# 09: Frontend (`apps/web`)

The goal is the **same look**: the existing Tailwind markup, colours, dark mode and charts are ported. The code underneath changes: TypeScript, typed data, small components, and no business logic in pages.

## Stack
- React 19, Vite, TypeScript strict, react-router 7.
- TanStack Query for all server state. There is no hand-rolled fetch in components.
- react-hook-form + zod resolvers, using the same schemas as the server, from `@pv/shared`.
- Tailwind 3 (the existing config is ported), recharts, lucide-react, react-hot-toast, `@react-oauth/google`, `@vercel/analytics`.
- PDF via jsPDF, ported from `utils/pdfGenerator.js`.

Dropped dependencies, which were unused in v1:
- `html2pdf.js`, `html2canvas` (only used by dead code)
- `jwt-decode`, `framer-motion`
- `@stripe/react-stripe-js`, `@stripe/stripe-js`

## Data layer (`src/lib/api`)
- `apiFetch(path, {method, body, schema})`:
  - The base URL is `VITE_API_URL`, with no fallback in production. The build fails if it is missing.
  - Sends `credentials: 'include'` and JSON only.
  - Parses the response with the zod `schema`.
  - Turns `{error}` into a typed `ApiError`.
  - On `TOKEN_EXPIRED` it makes a single refresh call (shared by all callers), then retries once.
- Query keys are defined in one `queryKeys.ts`, for example `['brand', id]`, `['run', id]` and `['insights', brandId, 'trend', range]`.
- Hooks per feature (`useBrand(id)`, `useRun(id)`, `useCreateRun()`, …).
  - `useRun` sets `refetchInterval: 2000` while the status is not final.
  - Mutations invalidate the queries they affect, for example creating a run invalidates `me` (credits) and `runs`.
- `useMe()` is the single source for user, workspace, credits and limits. This fixes v1, where the sidebar showed 0 credits after login.

## Routes
| Path | Feature | Notes |
|---|---|---|
| `/` | landing | Pricing from `GET /plans` |
| `/login`, `/register` (`?ref=`), `/verify-email`, `/forgot-password`, `/reset-password` | auth | |
| `/share/:token` | reports (readOnly) | public |
| `/app` | → `/app/brands` | protected layout with sidebar (credits, plan) |
| `/app/brands` | brands | list, limit info, add-brand button |
| `/app/brands/new` | brands/wizard | step 1 brand + analysis → step 2 categories → step 3 prompts → step 4 run config + estimate |
| `/app/brands/:brandId` | insights | overview dashboard (tabs: Overview · Competitors) |
| `/app/brands/:brandId/prompts` | prompts | library + per-prompt history |
| `/app/brands/:brandId/runs` | runs | brand run list, "New run" |
| `/app/brands/:brandId/runs/new` | runs | config form (prompts, platforms, location) + estimate |
| `/app/brands/:brandId/sources` | insights | citations and sources |
| `/app/brands/:brandId/schedules` | schedules | |
| `/app/brands/:brandId/settings` | brands | name, URL, aliases, competitors, defaults |
| `/app/runs` | runs | all runs, across brands |
| `/app/runs/:runId` | runs → reports | live progress while running, then the full report (`ReportView`) |
| `/app/billing` | billing | plans, top-ups, subscription, portal |
| `/app/credits` | credits | ledger, referral link, survey |
| `/app/settings` | settings | profile, password, sessions (logout everywhere) |
| `/terms`, `/privacy` | landing | static. v1 linked to them but they didn't exist |
| `*` | 404 page | v1 silently redirected to `/` |

The old v1 paths (`/reports/:id`, `/brands/:id/dashboard`, `/shared/:token`) get client-side redirects. That's cheap and keeps old bookmarks working until cutover plus 30 days.

## Folder structure
```
src/
  main.tsx, app/ (router.tsx, AppLayout.tsx, BrandLayout.tsx, providers.tsx, theme/)
  lib/api/ (client.ts, queryKeys.ts), lib/format.ts (dates, %, rank "—")
  components/ui/ (Modal, ConfirmDialog, Table, Badge, PlatformIcon, PlatformLabel, MetricTile, EmptyState, Spinner)
  components/charts/ (CategoryTick, VisibilityBar, TrendLine, GroupedRankBar)
  features/
    landing/  auth/  brands/ (wizard/, BrandForm, CompetitorsEditor)  prompts/
    runs/ (RunConfigForm, EstimateBanner, RunProgress, RunList)
    reports/ (ReportView, ResultsTable, AnswerModal, SnippetModal, CitationList, pdf/)
    insights/ (Overview, CompetitorsTab, SourcesPage, TrendCard)
    schedules/ (ScheduleList, ScheduleForm, PromptSelection)
    billing/  credits/ (Ledger, Referral, SurveyModal)  settings/  promo/
```

**Size rule:** no component file over about 300 lines, and pages only compose features.

| v1 file | Becomes |
|---|---|
| `Reports.jsx` (1,129 lines) | `wizard/` steps + `useWizard` + `shared/countries.ts` and `languages.ts` |
| `PerformanceSummary.jsx` (1,254 lines) | `insights/Overview`, `CompetitorsTab`, `TrendCard` + hooks |
| `BrandScheduledReports.jsx` (1,144 lines) | `schedules/*` |

## Key screens: behaviour changes vs v1

**Wizard (`/app/brands/new`)**
- Step 1 calls `POST /brands/analyze` and shows the summary, categories and suggested aliases for editing.
- Brand creation happens at the end of step 1.
- Steps 2–3 generate and save prompts.
- Step 4 is `RunConfigForm`:
  - platforms: only those in the plan are enabled, and the rest are shown locked with an upgrade hint
  - the estimate comes from `POST /runs/estimate`
  - low- and insufficient-credit modals are driven by the estimate
- Leaving midway is safe: the brand and prompts persist. That replaces v1's "save-progress" drafts.

**Run progress (`/app/runs/:runId`)**
- Shows a progress bar (ok / no_answer / failed / pending) and a per-platform breakdown, plus a cancel button.
- The run continues if the tab is closed.
- When the run reaches a final status, the same route renders `ReportView`.
- Run creation emits a `runCreated` event. `promo/` listens and shows `PromoPopup` 15 s later, once per session, keeping v1's behaviour without sessionStorage polling.

**ReportView** (one component, `readOnly` for shares)
- Metric tiles use the D-012 definitions and show `{num}/{den}`.
- Charts: by platform, by category, and the competitor share of voice.
- Results table: prompt × platform matrix.
  - Each cell shows mentioned, rank and cited.
  - Clicking a cell opens the answer, snippet, citations and vendor list.
- Filters are **server-side** (`/runs/:id/results` query params).
- Actions: share (copy link, revoke), export (PDF, XLSX), schedule this setup (prefilled schedule form, with any frequency, not v1's hardcoded weekly).

**Brand overview**
- The latest run's aggregates.
- The trend, with markers where the prompt set changed.
- Platform scores, category visibility, ranked/missed prompts, top cited domains, next scheduled run.
- Every filter actually filters.

**Competitors tab**
- All tracked competitors: visibility, average rank, share of voice.
- A per-prompt rank matrix.
- Suggested competitors with an "add to tracked" button.

**Schedules**
- A list with labels, plus a form for frequency, hour/timezone, platforms and prompt selection (all active / fixed subset).
- A cost-per-run preview, pause/resume, run now, and the last run link.
- Prompt editing lives only in the prompt library. v1 had two editors, one of which lost data.

## Quality gates
- `tsc --noEmit` and ESLint (react-hooks, jsx-a11y) in CI.
- Vitest + Testing Library for hooks and key components: `ReportView` formatting, `RunProgress`, wizard steps.
- Playwright e2e locally and in CI with `FAKE_PROVIDERS=true` (see CHECKLIST P5/P8).
- Lighthouse on landing and report pages: no regressions vs v1.
