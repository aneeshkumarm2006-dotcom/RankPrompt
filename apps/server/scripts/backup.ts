/**
 * Backups of the v2 database (TODO 8.4):
 *
 *   pnpm db:backup dump [--out <dir>]
 *   pnpm db:backup restore --archive <file> --to <scratch db> [--yes]
 *
 * `dump` runs `mongodump` on the database named in MONGODB_URI and writes
 * `<dir>/<db>-<UTC time>.archive.gz` plus a `.manifest.json` (default dir: `backups/` at the repo
 * root, git-ignored). It only reads.
 *
 * `restore` loads an archive into a scratch database on the cluster of RESTORE_MONGODB_URI
 * (default: MONGODB_URI's cluster). The name must contain `restore` or `scratch` and differ from
 * the source. Without `--yes` it only prints what it would do. Afterwards it checks the scratch
 * database against the manifest (collections, counts, indexes) and runs the ledger
 * reconciliation on it; exit code 1 if anything is off. Drop the scratch database when done.
 *
 * Needs the MongoDB Database Tools (`mongodump`, `mongorestore`) on PATH or in MONGO_TOOLS_DIR.
 * MONGODB_URI comes from the environment, or apps/server/.env outside production. Production DB
 * access is user-run (CLAUDE.md): an agent prepares the command, the user runs it.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { pino } from 'pino';
import { noopReporter } from '../src/config/sentry';
import { connectDb, disconnectDb } from '../src/db/connection';
import { AdminError } from '../src/admin';
import {
  assertScratchDb,
  dumpDatabase,
  readManifest,
  redactUri,
  restoreArchive,
  verifyRestore,
  withDb,
} from '../src/admin/backup';
import { reconcileLedger } from '../src/modules/credits/reconcile';

const USAGE = `Usage:
  pnpm db:backup dump [--out <dir>]
  pnpm db:backup restore --archive <file> --to <scratch db> [--yes]`;

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

async function main(): Promise<void> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      out: { type: 'string' },
      archive: { type: 'string' },
      to: { type: 'string' },
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
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new AdminError('MONGODB_URI is not set');

  if (command === 'dump') {
    const outDir = resolve(values.out ?? resolve(REPO_ROOT, 'backups'));
    console.log(`dumping ${redactUri(uri)} → ${outDir}`);
    const { archive, manifestPath, manifest } = await dumpDatabase({ uri, outDir });
    const total = Object.values(manifest.collections).reduce((s, c) => s + c.after, 0);
    console.log(
      `done: ${archive}\nmanifest: ${manifestPath}\n` +
        `${Object.keys(manifest.collections).length} collections, ${total} documents (${manifest.tools})`,
    );
    return;
  }

  if (command === 'restore') {
    if (!values.archive || !values.to)
      throw new AdminError(`--archive and --to are required\n\n${USAGE}`);
    const archive = resolve(values.archive);
    const manifest = readManifest(archive);
    assertScratchDb(values.to, manifest.db);
    const target = process.env.RESTORE_MONGODB_URI ?? uri;
    if (!values.yes) {
      console.log(
        JSON.stringify(
          {
            dryRun: true,
            archive,
            from: manifest.db,
            dumpedAt: manifest.startedAt,
            wouldDropAndRestoreInto: redactUri(withDb(target, values.to)),
          },
          null,
          2,
        ),
      );
      return;
    }
    console.log(
      `restoring ${manifest.db} (${manifest.startedAt}) into ${redactUri(withDb(target, values.to))}`,
    );
    await restoreArchive({ archive, uri: target, to: values.to });
    const check = await verifyRestore({ uri: target, db: values.to, manifest });
    for (const c of check.collections) {
      console.log(
        `${c.ok ? '  ok  ' : '  FAIL'} ${c.name.padEnd(22)} ${String(c.restored).padStart(7)} docs (expected ${c.expected})${c.indexesOk ? '' : ', indexes differ'}`,
      );
    }
    await connectDb(withDb(target, values.to), {
      logger: pino({ level: 'error' }),
      autoIndex: false,
    });
    const reconcile = await reconcileLedger({
      logger: pino({ level: 'error' }),
      reporter: noopReporter,
    }).finally(() => disconnectDb());
    console.log(
      `${reconcile.mismatches.length ? '  FAIL' : '  ok  '} ledger = balance in ${reconcile.checked} workspaces` +
        (reconcile.mismatches.length ? ` (${reconcile.mismatches.length} mismatches)` : ''),
    );
    for (const p of check.problems) console.error(`  - ${p}`);
    if (!check.ok || reconcile.mismatches.length) {
      process.exitCode = 1;
      return;
    }
    console.log(`restore verified. Drop the scratch database "${values.to}" when you are done.`);
    return;
  }

  throw new AdminError(`unknown command "${command}"\n\n${USAGE}`);
}

main().catch((err: unknown) => {
  console.error(err instanceof AdminError ? `error: ${err.message}` : err);
  process.exitCode = 1;
});
