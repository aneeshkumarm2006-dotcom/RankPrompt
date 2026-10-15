# 07: Auth and security

## Sessions

**Origin (D-018):** the browser only talks to the web origin. Requests to `/api/*` are rewritten by Vercel to the Render service (proxied by Vite locally), so the cookies below are first-party and host-only, with no `Domain` attribute.

| Cookie | Content | Lifetime | Attributes |
|---|---|---|---|
| `pv_at` | Access JWT `{sub: userId, wid: workspaceId, sid: sessionId}`, HS256, signed with `JWT_ACCESS_SECRET` | 15 min | httpOnly, Secure, SameSite=Lax, host-only, Path=`/api` |
| `pv_rt` | Opaque refresh token (32 random bytes, base64url) | 30 days | httpOnly, Secure, SameSite=Lax, host-only, Path=`/api/auth` |

**No token ever appears in a response body or in localStorage.**

**Refresh** (`POST /auth/refresh`):
1. Look up `sessions` by `sha256(pv_rt)`.
2. If it is valid and not revoked, issue a new pair, mark the old session row `replacedBy`, and set both cookies.
3. **Reuse detection:** if a token that was already replaced is presented again, revoke the whole `familyId` and return 401.

The web client calls refresh when any request returns `401 {code:'TOKEN_EXPIRED'}`. It runs one refresh at a time and retries the original request once.

**Logout** revokes the session and clears both cookies.

**Password change** revokes all other sessions.

## Sign-in methods

**Email and password**
- Passwords are hashed with bcrypt, cost 12. Minimum 8 characters, and the password is checked against a small common-password list.
- On login failure the API always returns `INVALID_CREDENTIALS`, whether the account doesn't exist, the password is wrong, or the account is Google-only. Unlike v1, it never reveals which.
- New accounts are created unverified. A verification email is sent (Resend), and the token expires after 24 hours. Unverified users can sign in and run with their signup credits, but they get no referral credit and must verify before buying.
- Password reset works through an emailed token that expires after 1 hour. Using it revokes all sessions.

**Google**
- The client gets an ID token from `@react-oauth/google`. The server verifies it with `google-auth-library` `verifyIdToken({ audience: GOOGLE_CLIENT_ID })`. If `GOOGLE_CLIENT_ID` is missing, the server refuses to boot.
- The token must have `email_verified === true`.
- If a user with that `googleId` exists, sign them in.
- Otherwise, if a user with that verified email exists, link `googleId` to that user and sign in. This is allowed because Google has verified the email.
- Otherwise create the user, a personal workspace and an owner membership, grant the signup bonus, and set `emailVerifiedAt = now`.
- Supabase is removed.

**Signup in one transaction:** user, workspace, membership, signup ledger row and pending referral row are all created together. Unlike v1, a half-created account can't exist.

## Request context and workspace isolation

`authMiddleware` turns `pv_at` into `req.ctx = { userId, workspaceId, role, sessionId }`, where `role` comes from `memberships`, cached for 60 s. **Every service and repo function takes `ctx` as its first argument.**

The workspace boundary is enforced in four layers:
1. **Repos:** every repo query adds `{ workspaceId: ctx.workspaceId }`. Looking up a resource by id is always `findOne({ _id, workspaceId })`. A resource in another workspace returns **404**, never 403, so ids can't be probed.
2. **Mongoose plugin** (`db/workspaceScope.ts`) on owned collections: `pre` hooks on `find*`, `update*`, `delete*`, `count*` and `aggregate` throw `WorkspaceScopeError` if the filter or first `$match` has no `workspaceId`. System code such as the worker, scheduler and Stripe handlers opts out explicitly with `.setOptions({ crossWorkspace: true })`, and those uses are reviewed.
3. **Lint:** `no-restricted-imports` blocks importing `*/model.ts` anywhere except the module's own `repo.ts`.
4. **Tests:** a cross-workspace suite creates workspaces A and B, then calls **every route that takes an id** as B against A's resources and expects 404, with no data changed (P3 exit criterion).

## Input handling

- **Validation:** every route has zod schemas for params, query and body, via the `validate()` middleware. Unknown keys are stripped, ObjectIds are validated, and the ids that reach the service layer are typed.
- **Mongo filter safety:** `mongoose.set('sanitizeFilter', true)` is set globally. Because inputs are validated as strings, the `{ "$ne": null }`-style operator injection from v1 can't happen.
- **Body parsing:** `express.json({ limit: '1mb' })` only. There is no `urlencoded`, because the API takes no forms. This rules out cross-site form POSTs.
- **CSRF:**
  1. Cookies are `SameSite=Lax`.
  2. State-changing requests must carry an `Origin` header equal to `APP_URL`, otherwise 403. Stripe webhooks are exempt and use signature verification instead.
  3. Only JSON content types are accepted.

## Rate limiting (`express-rate-limit`)

`app.set('trust proxy', 2)` in production, because requests pass through the Vercel middleware and then the Render proxy (D-018). Use `1` locally. Verify the count after go-live by logging `req.ip` against a known client IP. The Render URL is public, so `X-Forwarded-For` is trusted only on requests carrying the `x-pv-edge-secret` header that the Vercel middleware adds (`EDGE_PROXY_SECRET`); other requests are keyed on the address Render saw (D-028).

| Scope | Limit |
|---|---|
| Global per IP | 300 requests / 5 min |
| `POST /auth/login`, `/auth/register` per IP | 20 / 15 min |
| `POST /auth/login` per email | 10 / 15 min, then a temporary lockout with exponential delay |
| `/auth/forgot-password` per email | 3 / hour |
| `POST /runs`, `/brands/analyze`, `/prompts/generate` per workspace | 30 / hour (these cost money) |
| `GET /public/shares/:token` per IP | 60 / min |
| `/api/stripe/webhook` | exempt |

The counters are kept in memory for each instance. That is acceptable at this scale; move to a Mongo store if we ever run more than two instances.

## External calls and SSRF

The server **never fetches a URL that a user supplied** (D-013):
- **Favicons:** the client builds `https://www.google.com/s2/favicons?domain=<domain>&sz=64` itself.
- **Brand analysis:** reads the site through OpenAI's `web_search`.

If we ever need direct fetching, it has to go through `safeFetch()`:
- https only
- DNS resolved first, rejecting private, loopback, link-local and metadata IP ranges
- the connection pinned to the resolved IP
- 2 MB and 10 s limits
- at most 3 redirects, with each redirect re-checked

## Public shares

- Created with `POST /runs/:id/shares`. The response includes the plaintext token once; only `sha256(token)` is stored.
- Shares can be revoked (`DELETE /shares/:id`) and can optionally expire.
- Only finished runs can be shared.
- `GET /public/shares/:token` returns a **trimmed DTO**: brand name and domain, run date, platforms, aggregates (competitors by name), and per-check `{prompt, category, platform, status, mentioned, rank, cited, citedUrl, snippet, answer, citations[{url, domain, title}], competitors[{name, mentioned, rank, cited}]}` (D-023). Unknown, revoked and expired links all return the same 404.
  - It never returns ids, workspace data, costs, raw payloads or emails.
  - Responses carry `X-Robots-Tag: noindex` and `Cache-Control: private, max-age=60`.

## Errors and logging

- **Error shape:** `{ error: { code: 'INSUFFICIENT_CREDITS', message: 'Human readable', details? } }`. 5xx responses carry a generic message plus a `requestId`. Stack traces and provider messages never go to clients.
- **pino** redacts `req.headers.cookie`, `authorization`, `set-cookie`, `*.password`, `*.token` and every `*_API_KEY`.
- **Sentry** (server and web) captures 5xx responses, job failures after their last attempt, reconciliation mismatches, and spend-cap hits.

## Secrets

- Secrets come from Render and Vercel env vars only. Commit `.env.example` files with no values.
- **Rotate at cutover:**
  - every key n8n held (OpenAI, Perplexity, DataForSEO, and the n8n API and webhook secrets)
  - the live Stripe keys that are currently in `backend/.env` on developer machines
  - `JWT_SECRET`, which becomes `JWT_ACCESS_SECRET`
- **Test vs live:** development uses Stripe **test** keys. Live keys exist only in the Render environment, if real billing is turned on.

## Headers

- `helmet()` on the API.
- On the web app (Vercel `vercel.json` headers):
  - a strict CSP allowing self, Google OAuth, Stripe redirects, Vercel analytics, the Google favicon service and Google Fonts
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `X-Frame-Options: DENY`
- CORS on the API allows only `APP_URL`, with `credentials: true`.
