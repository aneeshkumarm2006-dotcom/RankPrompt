import { isDuplicateKeyError } from '../../db/errors';
import { ProviderSpendModel, type ProviderSpendDoc } from './model';

/** The UTC day a spend counts towards. */
export const spendDay = (at: Date = new Date()): string => at.toISOString().slice(0, 10);

export const providerSpendRepo = {
  /** Adds one call's cost to today's row (created on first use). */
  async add(provider: string, costMicros: number, at: Date = new Date()): Promise<void> {
    const update = { $inc: { costMicros, calls: 1 } };
    const filter = { date: spendDay(at), provider };
    try {
      await ProviderSpendModel.updateOne(filter, update, { upsert: true });
    } catch (err) {
      // Two upserts raced on a new day: the row exists now, so just add to it.
      if (!isDuplicateKeyError(err)) throw err;
      await ProviderSpendModel.updateOne(filter, update);
    }
  },

  /** Today's spend per provider, in micro-dollars. */
  async forDay(day: string = spendDay()): Promise<Map<string, number>> {
    const rows = await ProviderSpendModel.find({ date: day }).lean<ProviderSpendDoc[]>().exec();
    return new Map(rows.map((r) => [r.provider, r.costMicros]));
  },
};
