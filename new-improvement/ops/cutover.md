# Go-live runbook (P9)

**Scope (D-018):** v2 replaces v1 on the **existing** Render service, Vercel project, Atlas cluster and Stripe account. The domains don't change. The only user is the owner, so there's no customer migration (Q-005).

**Preconditions:**
- P1–P8 exit criteria are met.
- `reference/feature-parity.md` is signed off.
- Q-001…Q-003 are resolved in DECISIONS.md, or v1 values are accepted for now.

The user runs all production DB reads and writes. Claude prepares the commands.

## 1. Prepare (Claude)
Write out the exact settings for:
- the Render service: build and start commands, health check path, and every env var with `MONGODB_URI` pointing at the new `promptverse_v2` database
- the Vercel project: root `apps/web`, build settings, and the `/api` rewrite target

The exact settings are in [go-live.md](go-live.md) (TODO 9.1); the background is in [deployment.md](deployment.md).

## 2. Turn off n8n (user)
- In the n8n UI on `n8n.srv883399.hstgr.cloud`, **deactivate every workflow**, starting with the cron and schedule workflows.
- **Export all workflows to JSON** (each workflow's ⋯ menu → Download, or `n8n export:workflow --all --output=all.json` on the VPS) into one folder outside the repo, and tell Claude where it is. Claude runs `node scripts/scrub-n8n-export.mjs <folder>`, which removes credential ids, pinned data and webhook paths and redacts secret-looking values, then reviews the output and saves it to `new-improvement/reference/n8n-export/` as a record.

## 3. Dump the old DB (user)
```powershell
$env:MONGODB_URI = '<old MONGODB_URI, ending in /promptverse>'
pnpm db:backup dump --out "$HOME\pv-backups"
Remove-Item Env:MONGODB_URI
```
This is also the backup before switching (D-027): `promptverse_v2` is still empty. Details in [go-live.md](go-live.md) § 1.

## 4. Switch (user)
1. Apply the step 1 settings to the existing Render service, without `EDGE_PROXY_SECRET`, then deploy. Check that `/api/ready` is green.
2. Run index sync once: `pnpm admin sync-indexes --yes` with the production `MONGODB_URI` (go-live.md § 3).
3. Apply the step 1 settings to the existing Vercel project, then deploy.
4. Add `EDGE_PROXY_SECRET` on Render and check the client IP (go-live.md § 5).
5. Check that the existing Stripe webhook endpoint (`/api/stripe/webhook`) has the 5 events listed in deployment.md.

## 5. Smoke test (user + Claude)
The table with pass criteria is in [go-live.md](go-live.md) § 7.
- Register (email and Google), then verify the email (the link is in the log driver output, or arrives by email if Resend is set).
- Create a brand and run analysis.
- Run 5 prompts × 5 platforms.
- Check the report, share link, PDF and XLSX.
- Do a test-mode top-up.
- Create a daily schedule for the next hour and watch it run.

## 6. Clean up the repo (Claude)
1. Tag the last v1 commit: `git tag v1-final <sha> && git push origin v1-final`.
2. In one commit, delete `backend/`, `frontend/`, `AUDIT.md` and `DOCUMENTATION.md`.
3. Update the root `CLAUDE.md` to drop its v1 references.
4. After 30 days, remove the client-side v1 route redirects.

## 7. Later (user, when convenient)
- **Rotate the keys that n8n or v1 held:**
  - OpenAI
  - Perplexity
  - Gemini
  - DataForSEO
  - the old `JWT_SECRET`
  - the n8n API and webhook secrets
- Cancel the Hostinger VPS that runs n8n.
- Delete the Supabase project. It was never used.
- Drop the old database:
  ```js
  // mongosh "<old MONGODB_URI>"
  use promptverse
  db.dropDatabase()
  ```

## Rollback

Until step 7, rollback is just settings:
1. Revert the Render and Vercel settings to the v1 values. Redeploy from the `v1-final` tag if the folders have already been deleted.
2. Re-enable the n8n workflows.

The v1 DB is untouched until it's dropped in step 7.
