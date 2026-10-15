import mongoose from 'mongoose';

/**
 * Creates every registered model's collection and indexes, and waits for them. Development and
 * tests build indexes automatically (`autoIndex`); production runs this once at go-live
 * (ops/deployment.md). Transactions need collections to exist before they write to them.
 */
export async function ensureIndexes(): Promise<void> {
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
}

export interface IndexSyncEntry {
  collection: string;
  toCreate: string[];
  toDrop: string[];
}

/**
 * Production's index sync (go-live 9.5, `pnpm admin sync-indexes`). Production connects with
 * `autoIndex: false`, so this is what creates the collections and indexes there. Without `apply`
 * it only reports the difference between each schema and the database. With `apply` it creates
 * missing collections, builds missing indexes and drops indexes no schema declares
 * (`Model.syncIndexes()`). Callers import `./registerModels` first so every model is registered.
 */
export async function syncAllIndexes(apply: boolean): Promise<IndexSyncEntry[]> {
  const models = Object.values(mongoose.models).sort((a, b) =>
    a.collection.collectionName.localeCompare(b.collection.collectionName),
  );
  const report: IndexSyncEntry[] = [];
  for (const model of models) {
    const diff = await model.diffIndexes();
    report.push({
      collection: model.collection.collectionName,
      toCreate: diff.toCreate.map((keys: unknown) => JSON.stringify(keys)),
      toDrop: (diff.toDrop as unknown[]).map(String),
    });
    if (apply) await model.syncIndexes();
  }
  return report;
}
