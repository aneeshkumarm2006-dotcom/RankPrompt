import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it, inject } from 'vitest';
import { connectDb, disconnectDb } from '../src/db/connection';
import { syncAllIndexes } from '../src/db/indexes';
import '../src/db/registerModels';
import { silentLogger } from './helpers';

// Production connects with autoIndex off (go-live 9.5 runs `pnpm admin sync-indexes --yes`).
beforeAll(() =>
  connectDb(inject('mongoUri'), { logger: silentLogger, autoIndex: false, dbName: 'sync_test' }),
);
afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await disconnectDb();
});

describe('pnpm admin sync-indexes', () => {
  it('a dry run reports every index without creating anything', async () => {
    const report = await syncAllIndexes(false);
    expect(report.map((r) => r.collection)).toEqual(
      expect.arrayContaining(['users', 'workspaces', 'jobs', 'credit_ledger', 'runs']),
    );
    expect(report.every((r) => r.toCreate.length > 0 || r.toDrop.length === 0)).toBe(true);
    // Mongoose may create empty collections on connect (autoCreate); indexes are this script's job.
    const db = mongoose.connection.db!;
    for (const { name } of await db.listCollections().toArray()) {
      expect((await db.collection(name).indexes()).map((i) => i.name)).toEqual(['_id_']);
    }
  });

  it('applying creates every collection and index; a second pass has nothing to do', async () => {
    const first = await syncAllIndexes(true);
    const names = (await mongoose.connection.db!.listCollections().toArray()).map((c) => c.name);
    expect(names.sort()).toEqual(first.map((r) => r.collection).sort());

    const second = await syncAllIndexes(false);
    expect(second.every((r) => r.toCreate.length === 0 && r.toDrop.length === 0)).toBe(true);
  });

  it('drops an index no schema declares', async () => {
    const users = mongoose.connection.db!.collection('users');
    await users.createIndex({ legacyField: 1 }, { name: 'legacy_1' });
    expect((await syncAllIndexes(false)).find((r) => r.collection === 'users')?.toDrop).toEqual([
      'legacy_1',
    ]);
    await syncAllIndexes(true);
    expect((await users.indexes()).map((i) => i.name)).not.toContain('legacy_1');
  });
});
