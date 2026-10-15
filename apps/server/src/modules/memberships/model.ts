import { MEMBERSHIP_ROLES, type MembershipRole } from '@pv/shared';
import mongoose, { Schema, type Types } from 'mongoose';
import { workspaceScope } from '../../db/workspaceScope';

/** `memberships` (02 § Identity): links a user to a workspace with a role (`owner` for now). */
export interface MembershipDoc {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  userId: Types.ObjectId;
  role: MembershipRole;
  createdAt: Date;
  updatedAt: Date;
}

const membershipSchema = new Schema<MembershipDoc>(
  {
    workspaceId: { type: Schema.Types.ObjectId, required: true },
    userId: { type: Schema.Types.ObjectId, required: true },
    role: { type: String, enum: MEMBERSHIP_ROLES, required: true },
  },
  { timestamps: true },
);
membershipSchema.plugin(workspaceScope);
membershipSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });
membershipSchema.index({ userId: 1 });

export const MembershipModel = mongoose.model<MembershipDoc>(
  'Membership',
  membershipSchema,
  'memberships',
);
