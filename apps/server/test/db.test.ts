import mongoose, { Schema, Types } from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { inject } from 'vitest';
import { connectDb, disconnectDb, pingDb } from '../src/db/connection';
import { withTransaction } from '../src/db/transaction';
import { WorkspaceScopeError, workspaceScope } from '../src/db/workspaceScope';
import { silentLogger } from './helpers';

interface Widget {
  workspaceId: Types.ObjectId;
  name: string;
}

const widgetSchema = new Schema<Widget>({ name: { type: String, required: true } });
widgetSchema.plugin(workspaceScope);
const Widget = mongoose.model<Widget>('Widget', widgetSchema);

const wsA = new Types.ObjectId();
const wsB = new Types.ObjectId();

beforeAll(async () => {
  await connectDb(inject('mongoUri'), { logger: silentLogger, autoIndex: true, dbName: 'db_test' });
  await Widget.createCollection();
});
afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await disconnectDb();
});
beforeEach(async () => {
  await Widget.deleteMany({}).setOptions({ crossWorkspace: true });
  await Widget.create([
    { workspaceId: wsA, name: 'a1' },
    { workspaceId: wsA, name: 'a2' },
    { workspaceId: wsB, name: 'b1' },
  ]);
});

describe('connection', () => {
  it('pings', async () => {
    expect(await pingDb()).toBeGreaterThanOrEqual(0);
  });

  it('sanitizes operator injection in filters', async () => {
    expect(mongoose.get('sanitizeFilter')).toBe(true);
    // Unsanitized, { $ne: 'nothing' } would match every widget. Sanitized, it becomes
    // { $eq: { $ne: 'nothing' } }, which can't even be cast to the string path.
    const userInput: unknown = { $ne: 'nothing' };
    await expect(Widget.find({ workspaceId: wsA, name: userInput })).rejects.toThrow(/Cast/);
    const trusted = await Widget.find({ workspaceId: wsA, name: mongoose.trusted({ $ne: 'a1' }) });
    expect(trusted.map((w) => w.name)).toEqual(['a2']);
  });
});

describe('workspaceScope plugin', () => {
  it('adds a required workspaceId path', async () => {
    await expect(Widget.create({ name: 'orphan' })).rejects.toThrow(/workspaceId/);
  });

  it('allows queries filtered by workspaceId and only returns that workspace', async () => {
    const found = await Widget.find({ workspaceId: wsA }).lean();
    expect(found.map((w) => w.name).sort()).toEqual(['a1', 'a2']);
    expect(await Widget.countDocuments({ workspaceId: wsB })).toBe(1);
  });

  it.each([
    ['find', () => Widget.find({ name: 'a1' })],
    ['findOne', () => Widget.findOne({ name: 'a1' })],
    ['findById', () => Widget.findById(new Types.ObjectId())],
    ['updateMany', () => Widget.updateMany({}, { name: 'x' })],
    ['findOneAndUpdate', () => Widget.findOneAndUpdate({ name: 'a1' }, { name: 'x' })],
    ['deleteOne', () => Widget.deleteOne({ name: 'a1' })],
    ['countDocuments', () => Widget.countDocuments()],
    ['distinct', () => Widget.distinct('name')],
    ['estimatedDocumentCount', () => Widget.estimatedDocumentCount()],
  ])('throws on %s without workspaceId', async (_op, run) => {
    await expect(run()).rejects.toBeInstanceOf(WorkspaceScopeError);
    expect(await Widget.countDocuments({ workspaceId: wsA, name: 'a1' })).toBe(1);
  });

  it('requires aggregates to start with a $match on workspaceId', async () => {
    await expect(Widget.aggregate([{ $match: { name: 'a1' } }])).rejects.toBeInstanceOf(
      WorkspaceScopeError,
    );
    const scoped = await Widget.aggregate<{ n: number }>([
      { $match: { workspaceId: wsA } },
      { $count: 'n' },
    ]);
    expect(scoped).toEqual([{ n: 2 }]);
  });

  it('lets system code opt out with crossWorkspace, without leaking the option to the server', async () => {
    expect(await Widget.countDocuments({}).setOptions({ crossWorkspace: true })).toBe(3);
    const all = await Widget.aggregate<{ n: number }>([{ $count: 'n' }]).option({
      crossWorkspace: true,
    });
    expect(all).toEqual([{ n: 3 }]);
  });
});

describe('withTransaction', () => {
  it('commits every write together', async () => {
    await withTransaction(async (session) => {
      await Widget.create([{ workspaceId: wsA, name: 'a3' }], { session });
      await Widget.updateOne({ workspaceId: wsB, name: 'b1' }, { name: 'b2' }, { session });
    });
    expect(await Widget.countDocuments({ workspaceId: wsA })).toBe(3);
    expect(await Widget.countDocuments({ workspaceId: wsB, name: 'b2' })).toBe(1);
  });

  it('rolls back every write when the callback throws', async () => {
    await expect(
      withTransaction(async (session) => {
        await Widget.create([{ workspaceId: wsA, name: 'a3' }], { session });
        await Widget.deleteMany({ workspaceId: wsB }, { session });
        throw new Error('injected failure');
      }),
    ).rejects.toThrow('injected failure');
    expect(await Widget.countDocuments({ workspaceId: wsA })).toBe(2);
    expect(await Widget.countDocuments({ workspaceId: wsB })).toBe(1);
  });
});
