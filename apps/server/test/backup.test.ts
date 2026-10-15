import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { inject } from 'vitest';
import {
  assertScratchDb,
  dumpDatabase,
  parseMongoUri,
  redactUri,
  restoreArchive,
  verifyRestore,
  withDb,
} from '../src/admin/backup';
import { noopReporter } from '../src/config/sentry';
import { connectDb, disconnectDb } from '../src/db/connection';
import { reconcileLedger } from '../src/modules/credits/reconcile';
import { connectTestDb, makeTestApp, signUp, silentLogger } from './helpers';
import { brandWithPrompts, completeRun, createRun } from './runHelpers';

/**
 * TODO 8.4: `mongodump` of a v2 database and a verified restore into a scratch database. Needs the
 * MongoDB Database Tools (on PATH or in MONGO_TOOLS_DIR); without them the round trip is skipped
 * and only the guards are tested.
 */

const exe = (tool: string) =>
  process.env.MONGO_TOOLS_DIR
    ? join(process.env.MONGO_TOOLS_DIR, process.platform === 'win32' ? `${tool}.exe` : tool)
    : tool;
const hasTools = spawnSync(exe('mongodump'), ['--version']).status === 0;

const SOURCE = 'backup_test';
const SCRATCH = 'backup_test_restore';

describe('backup guards', () => {
  it('only restores into a scratch database that is not the source', () => {
    expect(() => assertScratchDb('promptverse_v2', 'promptverse_v2')).toThrow(/restore|scratch/);
    expect(() => assertScratchDb('promptverse', 'promptverse_v2')).toThrow(/restore|scratch/);
    expect(() => assertScratchDb('restore_x', 'restore_x')).toThrow(/differ/);
    expect(() => assertScratchDb('x.restore', 'y')).toThrow(/plain/);
    expect(() => assertScratchDb('pv_restore_2026', 'promptverse_v2')).not.toThrow();
  });

  it('parses and redacts URIs', () => {
    const srv = 'mongodb+srv://u:p%40ss@cluster0.x.mongodb.net/promptverse_v2?retryWrites=true';
    expect(parseMongoUri(srv)).toEqual({
      base: 'mongodb+srv://u:p%40ss@cluster0.x.mongodb.net',
      db: 'promptverse_v2',
      query: '?retryWrites=true',
    });
    expect(withDb(srv, 'pv_restore')).toBe(
      'mongodb+srv://u:p%40ss@cluster0.x.mongodb.net/pv_restore?retryWrites=true',
    );
    expect(withDb('mongodb://h1:1,h2:2/?replicaSet=rs0', 'db')).toBe(
      'mongodb://h1:1,h2:2/db?replicaSet=rs0',
    );
    expect(redactUri(srv)).toBe(
      'mongodb+srv://***@cluster0.x.mongodb.net/promptverse_v2?retryWrites=true',
    );
  });
});

describe.skipIf(!hasTools)('mongodump → restore round trip', () => {
  const { app } = makeTestApp();
  const outDir = mkdtempSync(join(tmpdir(), 'pv-backup-test-'));
  const uri = () => withDb(inject('mongoUri'), SOURCE);

  beforeAll(() => connectTestDb(SOURCE));
  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await disconnectDb();
    rmSync(outDir, { recursive: true, force: true });
  });

  it('dumps the database, restores it into a scratch database and verifies it', async () => {
    // Some real data: two accounts, brands, prompts, a finished run, ledger rows.
    for (let i = 0; i < 2; i++) {
      const user = await signUp(app);
      const { brandId, promptIds } = await brandWithPrompts(user.agent, 3);
      const run = await createRun(user.agent, { brandId, promptIds });
      await completeRun(user.agent, run.id);
    }
    const sourceRun = await mongoose.connection.db!.collection('runs').findOne({});

    const { archive, manifest } = await dumpDatabase({ uri: uri(), outDir });
    expect(manifest.db).toBe(SOURCE);
    expect(manifest.collections.runs?.after).toBe(2);
    expect(manifest.collections.credit_ledger?.indexes.length ?? 0).toBeGreaterThan(1);

    await restoreArchive({ archive, uri: inject('mongoUri'), to: SCRATCH });
    // Restoring again replaces the scratch copy instead of failing on duplicate ids.
    await restoreArchive({ archive, uri: inject('mongoUri'), to: SCRATCH });
    const check = await verifyRestore({ uri: inject('mongoUri'), db: SCRATCH, manifest });
    expect(check.problems).toEqual([]);
    expect(check.ok).toBe(true);

    // BSON types survive (ObjectId, Date, nested docs), and the ledger reconciles in the copy.
    await disconnectDb();
    await connectDb(withDb(inject('mongoUri'), SCRATCH), {
      logger: silentLogger,
      autoIndex: false,
    });
    const restoredRun = await mongoose.connection.db!.collection('runs').findOne({
      _id: sourceRun!._id,
    });
    expect(restoredRun).toEqual(sourceRun);
    const report = await reconcileLedger({ logger: silentLogger, reporter: noopReporter });
    expect(report.checked).toBeGreaterThanOrEqual(2);
    expect(report.mismatches).toEqual([]);
    await mongoose.connection.dropDatabase();
    await disconnectDb();
    await connectTestDb(SOURCE);
  }, 120_000);
});
