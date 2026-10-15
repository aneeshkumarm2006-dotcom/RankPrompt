import type { PromptSource } from '@pv/shared';
import { Types, type ClientSession } from 'mongoose';
import type { Ctx } from '../../http/context';
import { op } from '../../db/trusted';
import { PromptModel, type PromptDoc } from './model';

export type { PromptDoc };

type Scope = Pick<Ctx, 'workspaceId'>;

const oid = (id: string | Types.ObjectId) => new Types.ObjectId(id);
const ws = (ctx: Scope) => ({ workspaceId: oid(ctx.workspaceId) });

export interface NewPrompt {
  text: string;
  category: string;
  source: PromptSource;
  replacesId?: Types.ObjectId | null;
}

/** Every query is filtered by the caller's workspace (07, layer 1). */
export const promptsRepo = {
  listForBrand(ctx: Scope, brandId: string, includeArchived: boolean): Promise<PromptDoc[]> {
    return PromptModel.find({
      ...ws(ctx),
      brandId: oid(brandId),
      ...(includeArchived ? {} : { archivedAt: null }),
    })
      .sort({ createdAt: 1, _id: 1 })
      .lean<PromptDoc[]>()
      .exec();
  },

  async insertMany(
    ctx: Scope,
    brandId: string,
    prompts: readonly NewPrompt[],
    session?: ClientSession,
  ): Promise<PromptDoc[]> {
    const docs = await PromptModel.insertMany(
      prompts.map((p) => ({ ...p, ...ws(ctx), brandId: oid(brandId) })),
      session ? { session } : {},
    );
    return docs.map((d) => d.toObject<PromptDoc>());
  },

  /** The active prompts of a brand among `ids` (a run may only use those). */
  findActiveByIds(ctx: Scope, brandId: string, ids: readonly string[]): Promise<PromptDoc[]> {
    return PromptModel.find({
      ...ws(ctx),
      brandId: oid(brandId),
      _id: op({ $in: ids.map(oid) }),
      archivedAt: null,
    })
      .lean<PromptDoc[]>()
      .exec();
  },

  /** Every prompt of a brand with these ids, archived ones included (prompt history). */
  findByIds(ctx: Scope, brandId: string, ids: readonly Types.ObjectId[]): Promise<PromptDoc[]> {
    return PromptModel.find({ ...ws(ctx), brandId: oid(brandId), _id: op({ $in: [...ids] }) })
      .lean<PromptDoc[]>()
      .exec();
  },

  findById(ctx: Scope, id: string): Promise<PromptDoc | null> {
    return PromptModel.findOne({ ...ws(ctx), _id: oid(id) })
      .lean<PromptDoc>()
      .exec();
  },

  findActiveById(ctx: Scope, id: string): Promise<PromptDoc | null> {
    return PromptModel.findOne({ ...ws(ctx), _id: oid(id), archivedAt: null })
      .lean<PromptDoc>()
      .exec();
  },

  /** Archives an active prompt. False when it was already archived (or never existed). */
  async archive(
    ctx: Scope,
    id: string | Types.ObjectId,
    session?: ClientSession,
  ): Promise<boolean> {
    const res = await PromptModel.updateOne(
      { ...ws(ctx), _id: oid(id), archivedAt: null },
      { $set: { archivedAt: new Date() } },
      session ? { session } : {},
    );
    return res.modifiedCount === 1;
  },

  /** Category is not part of a prompt's identity, so it changes in place (D-014 covers text). */
  updateCategory(ctx: Scope, id: string, category: string): Promise<PromptDoc | null> {
    return PromptModel.findOneAndUpdate(
      { ...ws(ctx), _id: oid(id), archivedAt: null },
      { $set: { category } },
      { new: true },
    )
      .lean<PromptDoc>()
      .exec();
  },

  /** Active prompt count per brand, for the brands list. */
  async countActiveByBrand(ctx: Scope): Promise<Map<string, number>> {
    const rows = await PromptModel.aggregate<{ _id: Types.ObjectId; n: number }>([
      { $match: { ...ws(ctx), archivedAt: null } },
      { $group: { _id: '$brandId', n: { $sum: 1 } } },
    ]);
    return new Map(rows.map((r) => [r._id.toHexString(), r.n]));
  },
};
