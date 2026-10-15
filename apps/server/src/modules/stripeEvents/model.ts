import mongoose, { Schema, type Types } from 'mongoose';

export const STRIPE_EVENT_STATUSES = ['processing', 'done', 'failed'] as const;
export type StripeEventStatus = (typeof STRIPE_EVENT_STATUSES)[number];

/**
 * `stripe_events` (02, 06 § Webhook processing): one row per Stripe event id, so a redelivered or
 * concurrently delivered event is handled once. System data, no `workspaceId`.
 */
export interface StripeEventDoc {
  _id: Types.ObjectId;
  eventId: string;
  type: string;
  status: StripeEventStatus;
  attempts: number;
  error: string | null;
  /** When the current attempt started; a `processing` row older than the takeover window is stale. */
  claimedAt: Date;
  receivedAt: Date;
  processedAt: Date | null;
}

const stripeEventSchema = new Schema<StripeEventDoc>(
  {
    eventId: { type: String, required: true },
    type: { type: String, required: true },
    status: { type: String, enum: STRIPE_EVENT_STATUSES, required: true },
    attempts: { type: Number, default: 1 },
    error: { type: String, default: null },
    claimedAt: { type: Date, required: true },
    receivedAt: { type: Date, required: true },
    processedAt: { type: Date, default: null },
  },
  { minimize: false },
);
stripeEventSchema.index({ eventId: 1 }, { unique: true });

export const StripeEventModel = mongoose.model<StripeEventDoc>(
  'StripeEvent',
  stripeEventSchema,
  'stripe_events',
);
