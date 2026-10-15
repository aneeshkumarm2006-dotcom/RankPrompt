import type { Types } from 'mongoose';
import { isDuplicateKeyError } from '../../db/errors';
import { op } from '../../db/trusted';
import { EmailLogModel, type EmailLogDoc, type EmailStatus } from './model';

export type { EmailLogDoc, EmailStatus };

export interface NewEmailLog {
  workspaceId: Types.ObjectId | null;
  userId: Types.ObjectId | null;
  template: string;
  to: string;
  idempotencyKey: string;
}

export const emailLogRepo = {
  /** Records a queued email once per idempotency key. True when this call created the row. */
  async recordQueued(row: NewEmailLog): Promise<boolean> {
    try {
      const res = await EmailLogModel.updateOne(
        { idempotencyKey: row.idempotencyKey },
        { $setOnInsert: { ...row, status: 'queued' } },
        { upsert: true },
      );
      return res.upsertedCount === 1;
    } catch (err) {
      if (isDuplicateKeyError(err)) return false;
      throw err;
    }
  },

  findByKey(idempotencyKey: string): Promise<EmailLogDoc | null> {
    return EmailLogModel.findOne({ idempotencyKey }).lean<EmailLogDoc>().exec();
  },

  async markSent(idempotencyKey: string, driver: string, resendId: string | null): Promise<void> {
    await EmailLogModel.updateOne(
      { idempotencyKey },
      {
        $set: { status: 'sent', driver, resendId, error: null, sentAt: new Date() },
        $inc: { attempts: 1 },
      },
    );
  },

  async markAttemptFailed(idempotencyKey: string, error: string): Promise<void> {
    await EmailLogModel.updateOne(
      { idempotencyKey, status: op({ $ne: 'sent' }) },
      { $set: { error }, $inc: { attempts: 1 } },
    );
  },

  /** A final state other than sent: `failed` (gave up) or `suppressed` (the user opted out). */
  async markFinal(
    idempotencyKey: string,
    status: Exclude<EmailStatus, 'queued' | 'sent'>,
    error: string | null,
  ): Promise<void> {
    await EmailLogModel.updateOne(
      { idempotencyKey, status: op({ $ne: 'sent' }) },
      { $set: { status, error } },
    );
  },

  /** Tests and support: the emails of one workspace, newest first. */
  listForWorkspace(workspaceId: Types.ObjectId, limit = 100): Promise<EmailLogDoc[]> {
    return EmailLogModel.find({ workspaceId })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .lean<EmailLogDoc[]>()
      .exec();
  },
};
