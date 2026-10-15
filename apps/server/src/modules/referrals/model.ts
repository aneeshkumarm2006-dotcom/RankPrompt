import mongoose, { Schema, type Types } from 'mongoose';

export const REFERRAL_STATUSES = ['pending', 'credited', 'rejected'] as const;
export type ReferralStatus = (typeof REFERRAL_STATUSES)[number];

/**
 * `referrals` (02, 06 § Referral rules). Created `pending` at signup; the referrer is credited when
 * the referred user verifies their email (Stage 6.4). Keyed by the referred user, not a workspace.
 */
export interface ReferralDoc {
  _id: Types.ObjectId;
  referrerWorkspaceId: Types.ObjectId;
  referredUserId: Types.ObjectId;
  status: ReferralStatus;
  creditedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const referralSchema = new Schema<ReferralDoc>(
  {
    referrerWorkspaceId: { type: Schema.Types.ObjectId, required: true },
    referredUserId: { type: Schema.Types.ObjectId, required: true },
    status: { type: String, enum: REFERRAL_STATUSES, default: 'pending' },
    creditedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
referralSchema.index({ referredUserId: 1 }, { unique: true });
referralSchema.index({ referrerWorkspaceId: 1, status: 1 });

export const ReferralModel = mongoose.model<ReferralDoc>('Referral', referralSchema, 'referrals');
