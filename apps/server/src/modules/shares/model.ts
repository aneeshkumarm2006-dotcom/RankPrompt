import mongoose, { Schema, type Types } from 'mongoose';
import { workspaceScope } from '../../db/workspaceScope';

/**
 * `shares` (02, 07 § Public shares): a revocable public link to one run's report. Only the
 * SHA-256 of the token is stored; the plaintext is shown once, when the share is created.
 */
export interface ShareDoc {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  runId: Types.ObjectId;
  tokenHash: string;
  createdBy: Types.ObjectId | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  lastViewedAt: Date | null;
  viewCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const shareSchema = new Schema<ShareDoc>(
  {
    workspaceId: { type: Schema.Types.ObjectId, required: true },
    runId: { type: Schema.Types.ObjectId, required: true },
    tokenHash: { type: String, required: true },
    createdBy: { type: Schema.Types.ObjectId, default: null },
    expiresAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    lastViewedAt: { type: Date, default: null },
    viewCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);
shareSchema.plugin(workspaceScope);
shareSchema.index({ tokenHash: 1 }, { unique: true });
shareSchema.index({ workspaceId: 1, runId: 1, createdAt: -1 });

export const ShareModel = mongoose.model<ShareDoc>('Share', shareSchema, 'shares');
