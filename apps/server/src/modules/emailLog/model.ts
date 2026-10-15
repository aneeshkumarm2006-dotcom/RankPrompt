import mongoose, { Schema, type Types } from 'mongoose';

export const EMAIL_STATUSES = ['queued', 'sent', 'failed', 'suppressed'] as const;
export type EmailStatus = (typeof EMAIL_STATUSES)[number];

/**
 * `email_log` (02 § Other collections, 10 § Email): one row per email, keyed by its idempotency
 * key. Written when the email is queued and updated when the `send_email` job sends it (or gives
 * up, or finds the user opted out). Never holds the body: verify and reset links are credentials.
 * A system collection (the worker writes it), so no workspace-scope plugin; `workspaceId` is
 * there for support lookups.
 */
export interface EmailLogDoc {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId | null;
  userId: Types.ObjectId | null;
  template: string;
  to: string;
  idempotencyKey: string;
  status: EmailStatus;
  /** `log` or `resend`: the driver that sent it. */
  driver: string | null;
  /** The provider's message id (Resend), null for the log driver. */
  resendId: string | null;
  error: string | null;
  attempts: number;
  sentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const emailLogSchema = new Schema<EmailLogDoc>(
  {
    workspaceId: { type: Schema.Types.ObjectId, default: null },
    userId: { type: Schema.Types.ObjectId, default: null },
    template: { type: String, required: true },
    to: { type: String, required: true },
    idempotencyKey: { type: String, required: true },
    status: { type: String, enum: EMAIL_STATUSES, required: true, default: 'queued' },
    driver: { type: String, default: null },
    resendId: { type: String, default: null },
    error: { type: String, default: null },
    attempts: { type: Number, default: 0 },
    sentAt: { type: Date, default: null },
  },
  { timestamps: true },
);
emailLogSchema.index({ idempotencyKey: 1 }, { unique: true });
emailLogSchema.index({ workspaceId: 1, createdAt: -1 });
emailLogSchema.index({ userId: 1, template: 1, createdAt: -1 });

export const EmailLogModel = mongoose.model<EmailLogDoc>('EmailLog', emailLogSchema, 'email_log');
