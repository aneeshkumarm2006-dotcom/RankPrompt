import { CREDIT_BUCKETS, LEDGER_REASONS, type CreditBucket, type LedgerReason } from '@pv/shared';
import mongoose, { Schema, type Types } from 'mongoose';
import { workspaceScope } from '../../db/workspaceScope';

export type { LedgerReason };

/** `credit_ledger` (02 § Money, 06): append-only; every balance change has exactly one row. */
export interface LedgerDoc {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  delta: number;
  bucket: CreditBucket;
  reason: LedgerReason;
  refType: string;
  refId: string;
  balanceAfter: { plan: number; purchased: number };
  note: string;
  actorUserId: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const ledgerSchema = new Schema<LedgerDoc>(
  {
    workspaceId: { type: Schema.Types.ObjectId, required: true },
    delta: { type: Number, required: true, validate: Number.isInteger },
    bucket: { type: String, enum: CREDIT_BUCKETS, required: true },
    reason: { type: String, enum: LEDGER_REASONS, required: true },
    refType: { type: String, required: true },
    refId: { type: String, required: true },
    balanceAfter: {
      plan: { type: Number, required: true },
      purchased: { type: Number, required: true },
    },
    note: { type: String, default: '' },
    actorUserId: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true },
);
ledgerSchema.plugin(workspaceScope);
ledgerSchema.index({ workspaceId: 1, createdAt: -1 });
// Idempotency (06): one grant per invoice, one refund per run per bucket, one signup bonus, …
ledgerSchema.index({ reason: 1, bucket: 1, refType: 1, refId: 1 }, { unique: true });

export const LedgerModel = mongoose.model<LedgerDoc>('LedgerEntry', ledgerSchema, 'credit_ledger');
