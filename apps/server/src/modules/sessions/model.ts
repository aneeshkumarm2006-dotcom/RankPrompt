import mongoose, { Schema, type Types } from 'mongoose';

/**
 * `sessions` (02, 07 § Sessions): one row per refresh token. Rotation marks the old row
 * `replacedBy` the new one in the same family; presenting a replaced token revokes the family.
 */
export interface SessionDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  /** The workspace the access token is issued for. */
  workspaceId: Types.ObjectId;
  familyId: string;
  /** SHA-256 of the refresh token; the token itself is never stored. */
  tokenHash: string;
  userAgent: string;
  ip: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const sessionSchema = new Schema<SessionDoc>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    workspaceId: { type: Schema.Types.ObjectId, required: true },
    familyId: { type: String, required: true },
    tokenHash: { type: String, required: true },
    userAgent: { type: String, default: '' },
    ip: { type: String, default: '' },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    replacedBy: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true },
);
sessionSchema.index({ tokenHash: 1 }, { unique: true });
sessionSchema.index({ userId: 1 });
sessionSchema.index({ familyId: 1 });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const SessionModel = mongoose.model<SessionDoc>('Session', sessionSchema, 'sessions');
