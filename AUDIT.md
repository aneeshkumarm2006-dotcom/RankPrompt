# Codebase Audit Report

## Summary

The RankPrompt (PromptVerse) codebase is a full-stack Node.js/React application with **MongoDB, Stripe, OpenAI, and n8n** integrations. Overall, the project is functionally complete and well-structured, but the audit uncovered **~55 issues** across security, correctness, consistency, performance, and tech debt.

**Highest-priority concerns:**

1. A **crash-level bug** in `analysisController.js` referencing an undefined `categories` variable
2. An **undefined `hasValidResponse`** variable in the same controller
3. The **refresh token using the same JWT secret** as the access token (undermining token rotation security)
4. **Duplicate `sendTokenResponse` implementations** with different response shapes causing inconsistent auth behavior
5. **No SSRF protection** on user-supplied URLs in `brandController.js` and `openaiController.js`

The frontend is generally solid but has several missing `useEffect` cleanup patterns, hardcoded pricing/plan data that should come from the backend, and a default Vite `App.css` still present.

---

## Stage 1 — Critical Fixes (Fix before anything else)

> Security vulnerabilities, broken logic, data loss risks

### #1 — Reference to undefined `categories` variable

- **File:** `backend/controllers/analysisController.js` ~L294
- **Issue:** The function `storePromptsForScheduling` destructures `req.body` but never extracts `categories`, yet references `Array.isArray(categories)`.
- **Why It's Critical:** **Server crash** — any call to `POST /api/analysis/store-prompts` will throw `ReferenceError: categories is not defined` when that code path is hit.
- **Suggested Fix:** Either destructure `categories` from `req.body` or remove the `categories` length check entirely if categories are embedded in `prompts`.

### #2 — Undefined `hasValidResponse` used as success value

- **File:** `backend/controllers/analysisController.js` ~L429
- **Issue:** `hasValidResponse` is used as the `success` value in `initiateAnalysis` but is never defined.
- **Why It's Critical:** Results array always records `success: undefined` — downstream logic that checks `.success` will silently malfunction.
- **Suggested Fix:** Define `hasValidResponse` based on `n8nResponse.data` validation, e.g. `const hasValidResponse = !!n8nResponse.data;`.

### #3 — Refresh token signed with same `JWT_SECRET` as access token

- **File:** `backend/utils/jwt.js` L5, L12
- **Issue:** Both access and refresh tokens use the same `JWT_SECRET`.
- **Why It's Critical:** If an access token is leaked, it can be confused with a refresh token (and vice versa). Token rotation provides no additional security when both use the same secret.
- **Suggested Fix:** Use a separate `JWT_REFRESH_SECRET` env var for `generateRefreshToken`.

### #4 — Duplicate `sendTokenResponse` function with different response shapes

- **File:** `backend/controllers/authController.js` L356 vs `backend/utils/jwt.js` L18
- **Issue:** `authController` version omits `refreshToken` and `role`; `jwt.js` version includes them. The controller's local version shadows the utility.
- **Why It's Critical:** Clients may or may not receive `refreshToken` and `role` depending on which code path runs, causing auth inconsistencies.
- **Suggested Fix:** Remove the local `sendTokenResponse` in `authController.js` and import from `utils/jwt.js`. Ensure a single canonical response shape.

### #5 — No SSRF protection on user-supplied URL in `getFavicon`

- **File:** `backend/controllers/brandController.js` ~L50–75
- **Issue:** The server makes outbound HTTP/HTTPS requests to arbitrary URLs based on `req.query.url`.
- **Why It's Critical:** An attacker could probe internal network services (e.g., `http://169.254.169.254/latest/meta-data/`) via the server.
- **Suggested Fix:** Validate that the resolved hostname is not a private/internal IP. Use a URL allowlist or DNS-resolution check before making the request.

### #6 — No URL validation on `N8N_OPENAI` webhook URL

- **File:** `backend/controllers/openaiController.js` ~L37
- **Issue:** No validation on `N8N_OPENAI` webhook URL before `axios.post`. If env var is missing, `axios.post(undefined, ...)` throws an unhelpful error.
- **Why It's Critical:** Server 500 with no useful error message for users or operators.
- **Suggested Fix:** Add a null check: `if (!webhookUrl) return res.status(500).json({ success: false, message: 'N8N_OPENAI webhook not configured' });`

### #7 — `initiateAnalysis` sends response before background work finishes

- **File:** `backend/controllers/analysisController.js` ~L393–450
- **Issue:** Errors in background processing are silently swallowed (no logging of aggregate failures, no webhook/callback on completion).
- **Why It's Critical:** Users get "Analysis started" but have no way to know if it succeeded or failed. Results array is built but never saved or sent anywhere.
- **Suggested Fix:** Either implement a results webhook/callback, save results to DB, or switch to a job queue pattern.

### #8 — Rate limiter covers Stripe webhook endpoint

- **File:** `backend/server.js` L37–41
- **Issue:** Rate limiter set to 100 req/15 min globally including the Stripe webhook endpoint.
- **Why It's Critical:** Stripe sends bursts of webhooks; hitting the rate limit would cause missed payment events and data loss.
- **Suggested Fix:** Exempt `/api/stripe/webhook` from the rate limiter or apply separate, higher limits for webhook routes.

---

## Stage 2 — Important Fixes (Fix before adding new features)

> Bugs, unhandled errors, auth issues, missing validation

### #9 — Subscription cancellation wipes all credits

- **File:** `backend/controllers/stripeController.js` — `handleSubscriptionDeleted`
- **Issue:** Sets `credits: 0` when subscription is canceled, wiping any purchased or earned credits.
- **Impact:** Users who bought top-up credits lose them when their subscription ends — unfair credit loss.
- **Suggested Fix:** Only reset subscription-granted credits. Track earned/purchased credits separately, or only reset `creditsUsed`.

### #10 — Race condition in credit operations

- **File:** `backend/controllers/creditController.js` — `addCredits` / `deductCredits`
- **Issue:** Two concurrent requests can read the same `user.credits` value, both pass the check, and both deduct, resulting in negative balance.
- **Impact:** Double-spend on credits under concurrent requests.
- **Suggested Fix:** Use MongoDB `$inc` atomic operator instead of read-modify-write, or use `findOneAndUpdate` with a `credits >= amount` condition.

### #11 — Credit deduction happens after partial processing

- **File:** `backend/controllers/reportController.js` — `saveReport`
- **Issue:** Credit check and deduction happen **after** partial processing. If `deductCredits` throws, the request fails at 500 but work was already done.
- **Impact:** Inconsistent state — report may be partially created without credit deduction.
- **Suggested Fix:** Move credit check/deduction to the beginning of the function, before any DB writes.

### #12 — Full user document fetched on every auth request

- **File:** `backend/middleware/auth.js` L28
- **Issue:** `User.findById(decoded.id)` without `.select()` fetches the entire user document on every authenticated request.
- **Impact:** Unnecessary DB load on every API call.
- **Suggested Fix:** Use `.select('name email role credits allowedModels subscriptionTier currentPlan')` or cache user data.

### #13 — Scheduled prompts: no ownership verification

- **File:** `backend/controllers/analysisController.js` — `getScheduledPrompts`
- **Issue:** The `userId` query parameter is accepted **without ownership verification** — an authenticated user could pass another user's ID to see their scheduled prompts.
- **Impact:** **Information disclosure** — any authenticated user can view any other user's scheduled prompts.
- **Suggested Fix:** Remove the `userId` query parameter or restrict it to admin-only. Always use `req.user._id`.

### #14 — `generateWebhookToken` uses wrong user ID field

- **File:** `backend/controllers/analysisController.js` — `generateWebhookToken` L~738
- **Issue:** Uses `req.user.userId` (undefined) instead of `req.user._id`.
- **Impact:** Token is generated with `userId: undefined`, making it useless for authentication.
- **Suggested Fix:** Change to `const userId = req.user._id;` and `const email = req.user.email;`.

### #15 — Invalid OpenAI model identifier

- **File:** `backend/controllers/openaiController.js` L68, L228
- **Issue:** OpenAI model set to `gpt-5-chat-latest` — this is not a valid OpenAI model identifier.
- **Impact:** API calls will fail with a model-not-found error.
- **Suggested Fix:** Use a valid model like `gpt-4o` or `gpt-4o-mini`, or make it configurable via env var.

### #16 — Server continues running without database

- **File:** `backend/config/database.js` L13–14
- **Issue:** MongoDB connection failure is caught and logged but **server continues running** without a database.
- **Impact:** All DB operations will fail silently or throw unhandled errors later. Users get confusing 500 errors.
- **Suggested Fix:** Either retry connection with backoff, or exit the process on persistent failure. At minimum, set a global flag that middleware can check.

### #17 — Auth token stored in `localStorage`

- **File:** `frontend/src/services/api.js`
- **Issue:** Auth token stored in `localStorage` — accessible to any XSS script on the domain.
- **Impact:** If any XSS vulnerability exists, attacker can steal the auth token.
- **Suggested Fix:** Rely solely on `httpOnly` cookies for auth. Remove `localStorage` token storage or use it only as a fallback with clear documentation of the tradeoff.

### #18 — No rate limiting on public share endpoint

- **File:** `backend/controllers/reportController.js` — `getSharedReport`
- **Issue:** No rate limiting or abuse protection on public share endpoint.
- **Impact:** Shared report tokens could be brute-forced (32-char hex = strong, but no rate limit = unnecessary risk).
- **Suggested Fix:** Add per-IP rate limiting to the `/api/reports/shared/:token` route.

### #19 — Missing `AbortController` cleanup in `useEffect`

- **File:** `frontend/src/components/PerformanceSummary.jsx`
- **Issue:** Multiple `fetch` calls without `AbortController` cleanup in `useEffect`.
- **Impact:** Memory leaks if component unmounts before requests complete; potential state updates on unmounted component.
- **Suggested Fix:** Add `AbortController` and return cleanup function from `useEffect`.

### #20 — `sessionStorage` flag never cleared on logout

- **File:** `frontend/src/pages/Reports.jsx` ~L80
- **Issue:** `sessionStorage.setItem('lowCreditsModalShown', 'true')` is never cleared on logout.
- **Impact:** Modal never shows again even after re-login or credit changes until browser session ends.
- **Suggested Fix:** Clear this sessionStorage key in the logout flow.

---

## Stage 3 — Consistency & Quality (Clean up)

> Naming, structure, duplicate code, type mismatches

### #21 — Platform field naming inconsistency

- **File:** `backend/models/PromptSent.js` vs `backend/models/Report.js`
- **Issue:** PromptSent uses `google_ai_overviews` (snake_case, plural), Report uses `googleAiOverviews` (camelCase).
- **Impact:** Frontend must handle both formats, leading to mapping bugs (visible in `reportController.js` visibility trend logic).
- **Suggested Fix:** Standardize to one convention across all models.

### #22 — Inconsistent ref field naming

- **File:** `backend/models/CreditLog.js` vs other models
- **Issue:** `CreditLog` uses `user` as the ref field name; most other models use `userId`.
- **Impact:** Confusing for developers; increases risk of query bugs.
- **Suggested Fix:** Pick one convention (`userId` is more common in this codebase) and apply consistently.

### #23 — Redundant `currentPlan` and `subscriptionTier` fields

- **File:** `backend/models/User.js`
- **Issue:** Both `currentPlan` and `subscriptionTier` fields exist with identical enum values and are always set to the same value throughout the codebase.
- **Impact:** Redundant fields that must be kept in sync. One could get out of sync causing bugs.
- **Suggested Fix:** Remove one of them (`subscriptionTier` is less intuitive — keep `currentPlan`).

### #24 — Redundant default export in `authController`

- **File:** `backend/controllers/authController.js`
- **Issue:** Default export at bottom `export default { register, login, ... }` is redundant since all functions are already named exports.
- **Impact:** Dual export style — consumers may import either way, causing inconsistency.
- **Suggested Fix:** Remove the `export default` object; use only named exports.

### #25 — Redundant default export in `openaiController`

- **File:** `backend/controllers/openaiController.js`
- **Issue:** Same as #24 — has both named exports and `export default { ... }`.
- **Impact:** Same as above.
- **Suggested Fix:** Remove `export default`.

### #26 — `export default` placed before additional exports

- **File:** `backend/controllers/analysisController.js` L~755
- **Issue:** `export default { ... }` is placed **before** additional `export const` functions (`scheduleFromReport`, `toggleScheduledPrompt`, etc).
- **Impact:** The default export doesn't include later-defined functions. Importing via default gives incomplete API.
- **Suggested Fix:** Move `export default` to end of file and include all functions, or remove it entirely.

### #27 — Hardcoded pricing/plan data in multiple files

- **File:** `frontend/src/pages/Reports.jsx` & `frontend/src/pages/BuyCredits.jsx`
- **Issue:** Pricing/plan data (names, prices, credit amounts, features) is **hardcoded** in multiple frontend files and also in `backend/config/stripe.js`.
- **Impact:** Any pricing change requires updating 3+ files. High risk of mismatch.
- **Suggested Fix:** Create a shared config or fetch plan details from backend `/api/stripe/plans` endpoint.

### #28 — Hardcoded country list

- **File:** `frontend/src/pages/Reports.jsx`
- **Issue:** Country list (~40 entries) hardcoded in component.
- **Impact:** Duplicated if needed elsewhere; hard to maintain.
- **Suggested Fix:** Extract to a shared constants file or fetch from backend.

### #29 — Copyright year hardcoded

- **File:** `frontend/src/components/Footer.jsx` L~23
- **Issue:** Copyright year hardcoded as "2025".
- **Impact:** Will be incorrect starting 2026 (which is now).
- **Suggested Fix:** Use `new Date().getFullYear()`.

### #30 — Brand name inconsistency

- **File:** `frontend/src/index.html`
- **Issue:** Title says "PromptVerse" but `backend/server.js` root route says "PromptVerse API". Some components reference "RankPrompt".
- **Impact:** Brand name inconsistency.
- **Suggested Fix:** Standardize all references to the canonical product name.

### #31 — Default Vite boilerplate CSS

- **File:** `frontend/src/App.css`
- **Issue:** Contains the default Vite boilerplate CSS (`#root`, `.logo`, `.read-the-docs`, `logo-spin`).
- **Impact:** Dead CSS that overrides `#root` with `max-width: 1280px` and `text-align: center` — may cause unexpected layout issues.
- **Suggested Fix:** Delete the file or replace with project-specific styles.

### #32 — Orphaned data on brand deletion

- **File:** `backend/controllers/brandController.js` — `deleteBrand`
- **Issue:** Deletes reports and scheduled prompts for the brand but **doesn't delete PromptSent and PromptResponse** records.
- **Impact:** Orphaned data accumulates in the database.
- **Suggested Fix:** Also delete `PromptSent` and `PromptResponse` documents associated with the brand's reports.

---

## Stage 4 — Performance & Optimization

> Slow queries, memory leaks, unnecessary renders, caching

### #33 — Sequential OpenAI API calls

- **File:** `backend/controllers/openaiController.js` — `generatePrompts`
- **Issue:** Makes **sequential** OpenAI API calls in a `for` loop — one per category. With 10 categories, this takes 10x the time of parallel calls.
- **Impact:** Report generation is unnecessarily slow (10+ seconds for sequential calls).
- **Suggested Fix:** Use `Promise.all()` or `Promise.allSettled()` to parallelize category prompt generation.

### #34 — Full `reportData` fetched for list views

- **File:** `backend/controllers/reportController.js` — `getReportsByBrand`
- **Issue:** Fetches **full `reportData`** array for all reports of a brand. Each report can contain hundreds of KB of data.
- **Impact:** Excessive memory usage and slow response times for brands with many reports.
- **Suggested Fix:** Add `.select('-reportData')` for list views, or paginate.

### #35 — Visibility trend computed in JS instead of DB

- **File:** `backend/controllers/reportController.js` — `getVisibilityTrend`
- **Issue:** Fetches `reportData` for all reports in range and iterates through every item in JS.
- **Impact:** O(n*m) computation on the server for every trend request — should be aggregated.
- **Suggested Fix:** Use MongoDB aggregation pipeline, or compute and cache visibility scores when reports are saved.

### #36 — Inconsistent type coercion for `limit`

- **File:** `backend/controllers/reportController.js` — `getUserReports`
- **Issue:** `limit * 1` is used instead of `parseInt(limit)`.
- **Impact:** Works accidentally due to JS type coercion, but is unclear and inconsistent with `parseInt(page)` in the same function.
- **Suggested Fix:** Use `parseInt(limit, 10)` consistently.

### #37 — Oversized component with 23+ `useState` hooks

- **File:** `frontend/src/components/PerformanceSummary.jsx`
- **Issue:** 23+ `useState` hooks in a single component; ~1500+ lines.
- **Impact:** Every state change triggers re-render of the entire component. Large component is hard to maintain and test.
- **Suggested Fix:** Split into sub-components (`PlatformChart`, `CategoryChart`, `TrendChart`, etc.) and/or use `useReducer`.

### #38 — Recomputed derived state on every render

- **File:** `frontend/src/pages/CitationsAndSources.jsx`
- **Issue:** `allCategories` and `allPlatforms` computed via `new Set()` and `flatMap()` on every render.
- **Impact:** Unnecessary recomputation on each render cycle.
- **Suggested Fix:** Wrap in `useMemo` with `[sources]` dependency.

### #39 — No `AbortController` for fetch in `ReportView`

- **File:** `frontend/src/pages/ReportView.jsx`
- **Issue:** No `AbortController` for fetch requests. Complex ref-based dependency tracking in `useEffect`.
- **Impact:** Race condition: if `reportId` changes while a fetch is in-flight, stale data could overwrite fresh data.
- **Suggested Fix:** Use `AbortController` and abort previous request when `reportId` changes.

### #40 — Sequential favicon URL fetching

- **File:** `backend/controllers/brandController.js` — `getFavicon`
- **Issue:** Sequential HTTP requests to 6 favicon URLs.
- **Impact:** Slow favicon resolution (~3s timeout x up to 6 attempts = 18s worst case).
- **Suggested Fix:** Try first 2–3 URLs in parallel, fall back to Google's service immediately.

### #41 — No response compression

- **File:** `backend/server.js`
- **Issue:** No response compression middleware.
- **Impact:** All JSON responses sent uncompressed — larger payloads, slower transfers.
- **Suggested Fix:** Add `compression` middleware (`npm install compression`).

---

## Stage 5 — Tech Debt & Housekeeping

> Dead code, outdated packages, leftover TODOs, hardcoded values

### #42 — Vite boilerplate CSS file

- **File:** `frontend/src/App.css`
- **Issue:** Entire file is Vite boilerplate — unused styles for `.logo`, `.read-the-docs`, `logo-spin`.
- **Suggested Fix:** Delete the file entirely. Remove the import from `App.jsx`.

### #43 — Commented-out "Schedule Demo" button

- **File:** `frontend/src/components/CTA.jsx`
- **Issue:** Commented-out code (lines ~38–41).
- **Suggested Fix:** Remove commented-out code.

### #44 — Commented-out "View All Features" button

- **File:** `frontend/src/components/Features.jsx`
- **Issue:** Commented-out code (lines ~111–117).
- **Suggested Fix:** Remove commented-out code.

### #45 — Commented-out "Watch Demo" button & hardcoded stats

- **File:** `frontend/src/components/Hero.jsx`
- **Issue:** Commented-out code (lines ~95–99). Hardcoded marketing stats ("50K+ Queries", "10K+ Brands").
- **Suggested Fix:** Remove commented-out code. Make stats dynamic or clearly mark as marketing copy.

### #46 — Commented-out CTA section & unused import

- **File:** `frontend/src/components/HowItWorks.jsx`
- **Issue:** Commented-out CTA section (lines ~144–152). Potentially unused `ArrowRight` import.
- **Suggested Fix:** Remove dead code and unused import.

### #47 — Non-functional social media links

- **File:** `frontend/src/components/Footer.jsx`
- **Issue:** Social media links all point to `href="#"` — non-functional.
- **Suggested Fix:** Either add real URLs or remove the social links section.

### #48 — Commented-out "Earn Free Credits" menu item

- **File:** `frontend/src/components/Sidebar.jsx`
- **Issue:** Commented-out menu item (lines ~27–31).
- **Suggested Fix:** Remove or uncomment if the feature is ready.

### #49 — Default Vite template README

- **File:** `frontend/README.md`
- **Issue:** Default Vite template readme — no project-specific content.
- **Suggested Fix:** Replace with project-specific setup documentation or delete (since `DOCUMENTATION.md` exists at root).

### #50 — Unused `sendTokenResponse` export in `jwt.js`

- **File:** `backend/utils/jwt.js` — `sendTokenResponse`
- **Issue:** Exported but **never imported** anywhere — `authController.js` defines its own local version.
- **Suggested Fix:** Either use the utility version everywhere or delete it from `jwt.js`.

### #51 — `receiveN8nResult` endpoint does nothing

- **File:** `backend/controllers/analysisController.js` — `receiveN8nResult`
- **Issue:** Endpoint receives `req.body.data` but does **nothing** with it — just returns success.
- **Suggested Fix:** Implement actual result handling or remove the endpoint if unused.

### #52 — `creditsUsed` field never incremented

- **File:** `backend/models/User.js` — `creditsUsed`
- **Issue:** Field is set to `0` in Stripe webhook handlers but **never incremented** anywhere.
- **Suggested Fix:** Either implement credit usage tracking or remove the field.

### #53 — Dead `syncSubscriptionStatus` function

- **File:** `frontend/src/services/stripeService.js` — `syncSubscriptionStatus`
- **Issue:** Calls `POST /api/stripe/sync-subscription` but **no such route exists** in `stripeRoutes.js`.
- **Suggested Fix:** Remove the dead function or implement the backend route.

### #54 — Unused Supabase config

- **File:** `backend/config/supabase.js`
- **Issue:** Supabase client is initialized but **never used** — Google OAuth is handled via `google-auth-library` (`OAuth2Client`) in `authController.js`.
- **Suggested Fix:** Remove Supabase config and dependency if not needed, or document its intended future use.

### #55 — OpenAI client instantiation at module level

- **File:** `backend/controllers/openaiController.js` L1
- **Issue:** `OpenAI` client is instantiated at module level but `analyzeBrand` forwards to n8n webhook instead of using it. Only `generateCategories` and `generatePrompts` use the OpenAI client.
- **Suggested Fix:** Move OpenAI client initialization closer to where it's used, or note that `analyzeBrand` is a pass-through.

---

## Files Audited

### Backend

| File | Status |
|------|--------|
| `backend/package.json` | ✅ |
| `backend/server.js` | Issues #8, #30, #41 |
| `backend/config/database.js` | Issue #16 |
| `backend/config/stripe.js` | ✅ |
| `backend/config/supabase.js` | Issue #54 |
| `backend/middleware/auth.js` | Issue #12 |
| `backend/models/Brand.js` | ✅ |
| `backend/models/CreditLog.js` | Issue #22 |
| `backend/models/PromptResponse.js` | ✅ |
| `backend/models/PromptSent.js` | Issue #21 |
| `backend/models/Report.js` | ✅ |
| `backend/models/ScheduledPrompt.js` | ✅ |
| `backend/models/Survey.js` | ✅ |
| `backend/models/User.js` | Issues #23, #52 |
| `backend/controllers/analysisController.js` | Issues #1, #2, #7, #13, #14, #26, #51 |
| `backend/controllers/authController.js` | Issues #4, #24 |
| `backend/controllers/brandController.js` | Issues #5, #32, #40 |
| `backend/controllers/creditController.js` | Issue #10 |
| `backend/controllers/openaiController.js` | Issues #6, #15, #25, #33, #55 |
| `backend/controllers/reportController.js` | Issues #11, #18, #34, #35, #36 |
| `backend/controllers/stripeController.js` | Issue #9 |
| `backend/routes/analysisRoutes.js` | ✅ |
| `backend/routes/authRoutes.js` | ✅ |
| `backend/routes/brandRoutes.js` | ✅ |
| `backend/routes/creditRoutes.js` | ✅ |
| `backend/routes/openaiRoutes.js` | ✅ |
| `backend/routes/reportRoutes.js` | ✅ |
| `backend/routes/stripeRoutes.js` | ✅ |
| `backend/utils/jwt.js` | Issues #3, #50 |
| `backend/utils/referralCode.js` | ✅ |
| `backend/scripts/generateReferralCodes.js` | ✅ |

### Frontend

| File | Status |
|------|--------|
| `frontend/package.json` | ✅ |
| `frontend/index.html` | Issue #30 |
| `frontend/vite.config.js` | ✅ |
| `frontend/tailwind.config.js` | ✅ |
| `frontend/postcss.config.js` | ✅ |
| `frontend/eslint.config.js` | ✅ |
| `frontend/vercel.json` | ✅ |
| `frontend/README.md` | Issue #49 |
| `frontend/src/main.jsx` | ✅ |
| `frontend/src/App.jsx` | ✅ |
| `frontend/src/App.css` | Issues #31, #42 |
| `frontend/src/index.css` | ✅ |
| `frontend/src/context/AuthContext.jsx` | ✅ |
| `frontend/src/context/ThemeContext.jsx` | ✅ |
| `frontend/src/hooks/useTheme.js` | ✅ |
| `frontend/src/services/api.js` | Issue #17 |
| `frontend/src/services/stripeService.js` | Issue #53 |
| `frontend/src/utils/pdfGenerator.js` | ✅ |
| `frontend/src/components/AnalysisLoadingModal.jsx` | ✅ |
| `frontend/src/components/AnalysisProgressModal.jsx` | Issue #19 |
| `frontend/src/components/BrandSidebar.jsx` | ✅ |
| `frontend/src/components/CTA.jsx` | Issue #43 |
| `frontend/src/components/Features.jsx` | Issue #44 |
| `frontend/src/components/Footer.jsx` | Issues #29, #47 |
| `frontend/src/components/Hero.jsx` | Issue #45 |
| `frontend/src/components/HowItWorks.jsx` | Issue #46 |
| `frontend/src/components/InsufficientCreditsModal.jsx` | ✅ |
| `frontend/src/components/LowCreditsModal.jsx` | ✅ |
| `frontend/src/components/Navbar.jsx` | ✅ |
| `frontend/src/components/PerformanceSummary.jsx` | Issues #19, #37 |
| `frontend/src/components/Pricing.jsx` | Issue #27 |
| `frontend/src/components/ProtectedRoute.jsx` | ✅ |
| `frontend/src/components/SaveBrandModal.jsx` | ✅ |
| `frontend/src/components/Sidebar.jsx` | Issue #48 |
| `frontend/src/components/Step2BrandAnalysis.jsx` | ✅ |
| `frontend/src/components/Step3ReadyToAnalyze.jsx` | ✅ |
| `frontend/src/components/SurveyModal.jsx` | ✅ |
| `frontend/src/components/ThemeToggle.jsx` | ✅ |
| `frontend/src/pages/AllPrompts.jsx` | ✅ |
| `frontend/src/pages/AllReports.jsx` | ✅ |
| `frontend/src/pages/BrandDashboard.jsx` | ✅ |
| `frontend/src/pages/BrandReports.jsx` | ✅ |
| `frontend/src/pages/BrandScheduledReports.jsx` | Minor |
| `frontend/src/pages/BuyCredits.jsx` | Issue #27 |
| `frontend/src/pages/CitationsAndSources.jsx` | Issue #38 |
| `frontend/src/pages/Dashboard.jsx` | ✅ |
| `frontend/src/pages/EarnCredits.jsx` | ✅ |
| `frontend/src/pages/Landing.jsx` | ✅ |
| `frontend/src/pages/Login.jsx` | ✅ |
| `frontend/src/pages/MyBrands.jsx` | ✅ |
| `frontend/src/pages/Profile.jsx` | ✅ |
| `frontend/src/pages/Register.jsx` | ✅ |
| `frontend/src/pages/Reports.jsx` | Issues #20, #27, #28 |
| `frontend/src/pages/ReportView.jsx` | Issue #39 |
| `frontend/src/pages/SharedReport.jsx` | ✅ |
