import {
  CREDIT_BUCKETS,
  PLAN_STATUSES,
  PLAN_TIERS,
  type CountryCode,
  type LanguageCode,
  type PlanStatus,
  type PlanTier,
} from '@pv/shared';
import mongoose, { Schema, type Types } from 'mongoose';

/**
 * `workspaces` (02 § Identity). Owns plan, Stripe customer and credits (D-005). The workspace is
 * the tenant itself, so it is looked up by `_id` and has no workspace-scope plugin.
 */
export interface WorkspaceDoc {
  _id: Types.ObjectId;
  name: string;
  plan: {
    tier: PlanTier;
    status: PlanStatus;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
    pendingTier: PlanTier | null;
  };
  stripe: { customerId?: string; subscriptionId: string | null; priceId: string | null };
  /** A cache of the ledger: only ever changed together with a `credit_ledger` insert (06). */
  credits: { plan: number; purchased: number };
  /**
   * The billing period the plan credits were last reset for, and the allowance granted for it
   * (D-025). A paid invoice resets plan credits only when it opens a newer period, and tops them
   * up only when its tier's allowance is higher, so replays and late invoices change nothing.
   */
  planCredits: { periodStart: Date | null; allowance: number };
  referralCode: string;
  settings: { timezone: string; defaultCountry: CountryCode; defaultLanguage: LanguageCode };
  /** Reserved for white-label (deferred, D-005). */
  branding: Record<string, unknown> | null;
  /** Bumped inside transactions that must not run concurrently for one workspace. */
  lockVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

const int = { type: Number, required: true, default: 0, validate: Number.isInteger };

const workspaceSchema = new Schema<WorkspaceDoc>(
  {
    name: { type: String, required: true },
    plan: {
      tier: { type: String, enum: PLAN_TIERS, default: 'free' },
      status: { type: String, enum: PLAN_STATUSES, default: 'none' },
      currentPeriodEnd: { type: Date, default: null },
      cancelAtPeriodEnd: { type: Boolean, default: false },
      pendingTier: { type: String, enum: [...PLAN_TIERS, null], default: null },
    },
    stripe: {
      // No default: a stored null would collide in the unique sparse index.
      customerId: { type: String },
      subscriptionId: { type: String, default: null },
      priceId: { type: String, default: null },
    },
    credits: Object.fromEntries(CREDIT_BUCKETS.map((b) => [b, int])) as Record<
      (typeof CREDIT_BUCKETS)[number],
      typeof int
    >,
    planCredits: {
      periodStart: { type: Date, default: null },
      allowance: { type: Number, default: 0 },
    },
    referralCode: { type: String, required: true },
    settings: {
      timezone: { type: String, default: 'UTC' },
      defaultCountry: { type: String, default: 'US' },
      defaultLanguage: { type: String, default: 'en' },
    },
    branding: { type: Schema.Types.Mixed, default: null },
    lockVersion: { type: Number, default: 0 },
  },
  { timestamps: true, minimize: false },
);

workspaceSchema.index({ 'stripe.customerId': 1 }, { unique: true, sparse: true });
workspaceSchema.index({ referralCode: 1 }, { unique: true });

export const WorkspaceModel = mongoose.model<WorkspaceDoc>(
  'Workspace',
  workspaceSchema,
  'workspaces',
);
