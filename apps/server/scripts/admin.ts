/**
 * Admin scripts (TODO 4.10). Run from the repo root:
 *
 *   pnpm admin inspect-run --run <runId>
 *   pnpm admin recompute-aggregates --run <runId> --yes
 *   pnpm admin rerun-failed --run <runId> --yes
 *   pnpm admin adjust-credits --workspace <workspaceId> --bucket purchased --delta 10 --note "why" --yes
 *   pnpm admin reconcile
 *   pnpm admin stripe-portal --yes
 *   pnpm admin sync-indexes --yes
 *
 * `reconcile` runs the nightly ledger check now (read-only). `stripe-portal` creates the Customer
 * Portal configuration in the Stripe account of `STRIPE_SECRET_KEY` and prints its id; it needs
 * no database. `sync-indexes` creates the collections and indexes of every model (production
 * connects with `autoIndex: false`); run it once at go-live and after a schema adds an index.
 *
 * It connects to `MONGODB_URI` (from the environment, or apps/server/.env outside production).
 * Commands that write do nothing without `--yes`; they print what they would change instead.
 * Production DB access is user-run (CLAUDE.md): an agent prepares the command, the user runs it.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { creditBucketSchema } from '@pv/shared';
import { pino } from 'pino';
import {
  AdminError,
  adjustCredits,
  inspectRun,
  recomputeAggregates,
  rerunFailed,
} from '../src/admin';
import { noopReporter } from '../src/config/sentry';
import { connectDb, disconnectDb } from '../src/db/connection';
import { syncAllIndexes } from '../src/db/indexes';
import '../src/db/registerModels';
import { createPortalConfiguration } from '../src/modules/billing/portalConfig';
import { priceBookFromEnv } from '../src/modules/billing/prices';
import { reconcileLedger } from '../src/modules/credits/reconcile';

const USAGE = `Usage:
  pnpm admin inspect-run --run <runId>
  pnpm admin recompute-aggregates --run <runId> [--yes]
  pnpm admin rerun-failed --run <runId> [--yes]
  pnpm admin adjust-credits --workspace <id> --bucket plan|purchased --delta <±n> --note "<why>" [--yes]
  pnpm admin reconcile
  pnpm admin stripe-portal [--yes]
  pnpm admin sync-indexes [--yes]`;

const print = (value: unknown) => console.log(JSON.stringify(value, null, 2));

async function main(): Promise<void> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      run: { type: 'string' },
      workspace: { type: 'string' },
      bucket: { type: 'string' },
      delta: { type: 'string' },
      note: { type: 'string' },
      yes: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  });
  const command = positionals[0];
  if (!command || values.help) {
    console.log(USAGE);
    return;
  }

  const dotEnv = fileURLToPath(new URL('../.env', import.meta.url));
  if (process.env.NODE_ENV !== 'production' && existsSync(dotEnv)) process.loadEnvFile(dotEnv);

  if (command === 'stripe-portal') {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) throw new AdminError('STRIPE_SECRET_KEY is not set');
    const result = await createPortalConfiguration({
      secretKey,
      prices: priceBookFromEnv(process.env),
      appUrl: process.env.APP_URL ?? 'http://localhost:5173',
      create: values.yes,
    });
    print(
      result.id
        ? { created: result.id, next: `set STRIPE_PORTAL_CONFIGURATION_ID=${result.id}` }
        : { dryRun: true, wouldCreate: result.params },
    );
    return;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new AdminError('MONGODB_URI is not set');

  const need = (value: string | undefined, flag: string): string => {
    if (!value) throw new AdminError(`${flag} is required\n\n${USAGE}`);
    return value;
  };

  await connectDb(uri, { logger: pino({ level: 'warn' }), autoIndex: false });
  try {
    switch (command) {
      case 'sync-indexes': {
        const report = await syncAllIndexes(values.yes);
        print(values.yes ? { synced: report } : { dryRun: true, wouldSync: report });
        return;
      }

      case 'inspect-run':
        print(await inspectRun(need(values.run, '--run')));
        return;

      case 'recompute-aggregates': {
        const runId = need(values.run, '--run');
        if (!values.yes) {
          print({ dryRun: true, wouldRecompute: (await inspectRun(runId)).run });
          return;
        }
        print(await recomputeAggregates(runId));
        return;
      }

      case 'rerun-failed': {
        const runId = need(values.run, '--run');
        if (!values.yes) {
          const report = await inspectRun(runId);
          const failed = report.checks.filter((c) => c.status === 'failed');
          print({ dryRun: true, run: report.run, failedChecks: failed, credits: report.credits });
          return;
        }
        print(await rerunFailed(runId));
        return;
      }

      case 'adjust-credits': {
        const bucket = creditBucketSchema.safeParse(values.bucket);
        if (!bucket.success) throw new AdminError('--bucket must be plan or purchased');
        const delta = Number(need(values.delta, '--delta'));
        const args = {
          workspaceId: need(values.workspace, '--workspace'),
          bucket: bucket.data,
          delta,
          note: need(values.note, '--note'),
        };
        if (!values.yes) {
          print({ dryRun: true, wouldApply: args });
          return;
        }
        print(await adjustCredits(args));
        return;
      }

      case 'reconcile':
        print(await reconcileLedger({ logger: pino({ level: 'silent' }), reporter: noopReporter }));
        return;

      default:
        throw new AdminError(`unknown command "${command}"\n\n${USAGE}`);
    }
  } finally {
    await disconnectDb();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof AdminError ? `error: ${err.message}` : err);
  process.exit(1);
});
