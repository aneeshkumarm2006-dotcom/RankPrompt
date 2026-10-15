import type { MembershipRole } from '@pv/shared';
import { Types, type ClientSession } from 'mongoose';
import { MembershipModel } from './model';

export const membershipsRepo = {
  async create(
    session: ClientSession,
    m: { workspaceId: Types.ObjectId; userId: Types.ObjectId; role: MembershipRole },
  ): Promise<void> {
    await MembershipModel.create([m], { session });
  },

  /** The user's role in the workspace, or null when they aren't a member. */
  async roleOf(workspaceId: string, userId: string): Promise<MembershipRole | null> {
    const m = await MembershipModel.findOne(
      { workspaceId: new Types.ObjectId(workspaceId), userId: new Types.ObjectId(userId) },
      { role: 1 },
    )
      .lean<{ role: MembershipRole }>()
      .exec();
    return m?.role ?? null;
  },

  /** The workspace owners' user ids (billing emails go to them). */
  async ownerIds(workspaceId: Types.ObjectId): Promise<Types.ObjectId[]> {
    const rows = await MembershipModel.find({ workspaceId, role: 'owner' }, { userId: 1 })
      .lean<{ userId: Types.ObjectId }[]>()
      .exec();
    return rows.map((r) => r.userId);
  },
};
