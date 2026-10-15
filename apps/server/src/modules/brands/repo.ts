import { Types, type ClientSession } from 'mongoose';
import type { Ctx } from '../../http/context';
import { BrandModel, type BrandDoc, type CompetitorDoc } from './model';

export type { BrandDoc, CompetitorDoc };

type Scope = Pick<Ctx, 'workspaceId'>;

const oid = (id: string | Types.ObjectId) => new Types.ObjectId(id);
const ws = (ctx: Scope) => ({ workspaceId: oid(ctx.workspaceId) });

export type NewBrand = Omit<
  BrandDoc,
  '_id' | 'workspaceId' | 'archivedAt' | 'createdAt' | 'updatedAt'
>;
export type BrandPatch = Partial<
  Pick<
    BrandDoc,
    'name' | 'domain' | 'websiteUrl' | 'aliases' | 'summary' | 'categories' | 'defaults'
  >
>;

/** Every query is filtered by the caller's workspace (07, layer 1). */
export const brandsRepo = {
  countActive(ctx: Scope, session?: ClientSession): Promise<number> {
    return BrandModel.countDocuments(
      { ...ws(ctx), archivedAt: null },
      session ? { session } : {},
    ).exec();
  },

  listActive(ctx: Scope): Promise<BrandDoc[]> {
    return BrandModel.find({ ...ws(ctx), archivedAt: null })
      .sort({ createdAt: -1 })
      .lean<BrandDoc[]>()
      .exec();
  },

  /** Archived brands included: old runs and their prompts still refer to them. */
  findById(ctx: Scope, id: string): Promise<BrandDoc | null> {
    return BrandModel.findOne({ ...ws(ctx), _id: oid(id) })
      .lean<BrandDoc>()
      .exec();
  },

  findActiveById(ctx: Scope, id: string): Promise<BrandDoc | null> {
    return BrandModel.findOne({ ...ws(ctx), _id: oid(id), archivedAt: null })
      .lean<BrandDoc>()
      .exec();
  },

  findActiveByDomain(
    ctx: Scope,
    domain: string,
    session?: ClientSession,
  ): Promise<BrandDoc | null> {
    return BrandModel.findOne(
      { ...ws(ctx), domain, archivedAt: null },
      null,
      session ? { session } : {},
    )
      .lean<BrandDoc>()
      .exec();
  },

  async create(ctx: Scope, brand: NewBrand, session: ClientSession): Promise<BrandDoc> {
    const [doc] = await BrandModel.create([{ ...brand, ...ws(ctx) }], { session });
    if (!doc) throw new Error('brand insert returned nothing');
    return doc.toObject<BrandDoc>();
  },

  update(ctx: Scope, id: string, patch: BrandPatch): Promise<BrandDoc | null> {
    return BrandModel.findOneAndUpdate(
      { ...ws(ctx), _id: oid(id), archivedAt: null },
      { $set: patch },
      { new: true, runValidators: true },
    )
      .lean<BrandDoc>()
      .exec();
  },

  setCompetitors(ctx: Scope, id: string, competitors: CompetitorDoc[]): Promise<BrandDoc | null> {
    return BrandModel.findOneAndUpdate(
      { ...ws(ctx), _id: oid(id), archivedAt: null },
      { $set: { competitors } },
      { new: true, runValidators: true },
    )
      .lean<BrandDoc>()
      .exec();
  },

  /** Archives an active brand. False when there was no active brand with that id. */
  async archive(ctx: Scope, id: string, session: ClientSession): Promise<boolean> {
    const res = await BrandModel.updateOne(
      { ...ws(ctx), _id: oid(id), archivedAt: null },
      { $set: { archivedAt: new Date() } },
      { session },
    );
    return res.modifiedCount === 1;
  },
};
