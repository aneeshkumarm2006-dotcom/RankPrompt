# PromptVerse (RankPrompt) — project instructions

We are rebuilding PromptVerse as **v2**: a TypeScript monorepo with **no n8n**. All planning lives in [`new-improvement/`](new-improvement/README.md). Before working on anything, read these:

1. [new-improvement/CONTEXT.md](new-improvement/CONTEXT.md): the product, why we are rebuilding, the glossary
2. [new-improvement/DECISIONS.md](new-improvement/DECISIONS.md): decisions D-xx and open questions Q-xx
3. [new-improvement/TODO.md](new-improvement/TODO.md): the next step to do. Details and exit criteria are in [CHECKLIST.md](new-improvement/CHECKLIST.md).
4. The relevant `new-improvement/architecture/*.md` file for the area you're touching

## Commands (v2, pnpm at the repo root)
- `pnpm dev`: in-memory MongoDB + API (`:4000`) + web (`:5173`, proxies `/api`). Set `MONGODB_URI` in `apps/server/.env` to use a real DB instead.
- `pnpm typecheck` · `pnpm lint` · `pnpm format:check` · `pnpm test` · `pnpm build`: the same steps CI runs.
- `pnpm e2e`: Playwright suite, smoke + billing (its own in-memory DB, API on `:4100` with `FAKE_PROVIDERS=true` and a fake Stripe, `apps/server/scripts/e2e-server.ts`; web on `:5180`). First time: `pnpm exec playwright install chromium`.
- `pnpm loadtest`: 3 × 150 prompts × 5 platforms on fake providers with realistic latency and 429s (~12 min; `LOAD_TIME_SCALE=5` for a rough quick pass).
- `pnpm db:backup dump | restore --archive <f> --to <scratch> --yes`: `mongodump` backup of the DB in `MONGODB_URI` and a verified restore into a scratch DB (needs the MongoDB Database Tools; ops/deployment.md).
- `pnpm soak`: schedules + email soak on real timers (two instances, fake providers, its own in-memory DB; `SOAK_SECONDS`, default 60).
- `pnpm engine ask|run|export`: the analysis-engine CLI (03 § CLI). It reads keys from `apps/server/.env`, and `FAKE_PROVIDERS=true` gives canned answers. Real provider calls cost money, so quote the cost before any `run`.

## House rules
- `backend/` and `frontend/` are **v1, reference only**. Don't add features to them. v2 code goes in `apps/` and `packages/` on **`main`** (no `v2` branch). New root files must not break the live v1 builds.
- **Single-user beta (D-018):** no new accounts, staging, DNS or infrastructure. Reuse the existing Render, Vercel, Atlas cluster, Stripe (test mode) and API keys. Test locally, in CI and with fake providers. Optional services (Resend, Sentry) stay off unless a key is set.
- **No n8n or external automation** for core logic (D-001).
- **Platform ids** are only `chatgpt | perplexity | gemini | claude | google_aio`.
- **Metrics** are defined once, in `packages/shared/src/metrics.ts` (05). The UI never computes visibility itself.
- **Every owned query is workspace-scoped** in a repo. Models are imported only by their own `repo.ts` (07).
- **Credits** change only through the ledger service: an atomic `$inc` plus a ledger row, in one transaction (06).
- **Async work** must be safe with two instances running at once (04): atomic claims, fenced writes, idempotent finalize.
- When you finish a task, tick it in TODO.md (and in the matching CHECKLIST.md item) in the same change. When you change a decision, append a new entry to DECISIONS.md.
- **Production DB access:** the user runs prod DB reads and writes. Prepare the script and hand over the exact command.
- **Secrets** never go in the repo. Use `.env.example` with names only.
