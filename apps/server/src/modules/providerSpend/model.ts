import mongoose, { Schema, type Types } from 'mongoose';

/**
 * `provider_spend` (03 § Cost tracking): what each provider cost per UTC day, summed from the
 * checks. The worker stops claiming a provider's jobs once its daily cap is passed. System data,
 * not owned by a workspace.
 */
export interface ProviderSpendDoc {
  _id: Types.ObjectId;
  /** UTC day, `YYYY-MM-DD`. */
  date: string;
  provider: string;
  costMicros: number;
  calls: number;
  updatedAt: Date;
}

const spendSchema = new Schema<ProviderSpendDoc>(
  {
    date: { type: String, required: true },
    provider: { type: String, required: true },
    costMicros: { type: Number, default: 0 },
    calls: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);
spendSchema.index({ date: 1, provider: 1 }, { unique: true });

export const ProviderSpendModel = mongoose.model<ProviderSpendDoc>(
  'ProviderSpend',
  spendSchema,
  'provider_spend',
);
