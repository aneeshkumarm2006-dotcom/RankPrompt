import { Types } from 'mongoose';
import type { Logger } from '../config/logger';
import { jobsRepo } from '../jobs/repo';
import { emailLogRepo } from '../modules/emailLog/repo';
import { membershipsRepo } from '../modules/memberships/repo';
import { usersRepo, type UserDoc } from '../modules/users/repo';
import type { EmailTemplate, EmailTemplates } from './templates';

export interface EmailRequest<T extends EmailTemplate = EmailTemplate> {
  template: T;
  to: string;
  data: EmailTemplates[T];
  /** Unique per email (10 § Email table). The same key is never sent twice. */
  idempotencyKey: string;
  userId?: Types.ObjectId | null;
  workspaceId?: Types.ObjectId | null;
}

/** The `send_email` job's payload. */
export interface SendEmailPayload {
  template: string;
  to: string;
  data: Record<string, unknown>;
  idempotencyKey: string;
  userId: string | null;
}

export const emailJobKey = (idempotencyKey: string): string => `email:${idempotencyKey}`;

/**
 * Queues emails as `send_email` jobs (10 § Email). Nothing sends inline: the request (or the
 * worker job) that wants an email only queues it, and the job renders and sends it with retries.
 * A key that was ever queued is never queued again, so callers may call this as often as they
 * like (finalize retries, webhook redeliveries, two instances).
 */
export function createEmailOutbox(deps: { logger: Logger; onEnqueued?: () => void }) {
  async function send<T extends EmailTemplate>(req: EmailRequest<T>): Promise<boolean> {
    const workspaceId = req.workspaceId ?? null;
    const userId = req.userId ?? null;
    await emailLogRepo.recordQueued({
      workspaceId,
      userId,
      template: req.template,
      to: req.to,
      idempotencyKey: req.idempotencyKey,
    });
    const payload: SendEmailPayload = {
      template: req.template,
      to: req.to,
      data: req.data as unknown as Record<string, unknown>,
      idempotencyKey: req.idempotencyKey,
      userId: userId?.toHexString() ?? null,
    };
    const queued = await jobsRepo.enqueueOnce({
      type: 'send_email',
      payload: payload as unknown as Record<string, unknown>,
      workspaceId,
      dedupeKey: emailJobKey(req.idempotencyKey),
      maxAttempts: 6,
    });
    if (queued) deps.onEnqueued?.();
    return queued;
  }

  return {
    send,

    /**
     * One email per owner of the workspace (06, 10: billing and schedule emails go to the
     * owners). The key gets `:<userId>` so each owner's copy is its own row.
     */
    async toOwners<T extends EmailTemplate>(
      workspaceId: Types.ObjectId | string,
      template: T,
      idempotencyKey: string,
      data: (user: UserDoc) => EmailTemplates[T],
    ): Promise<number> {
      const wsId = new Types.ObjectId(workspaceId);
      let n = 0;
      for (const userId of await membershipsRepo.ownerIds(wsId)) {
        const user = await usersRepo.findById(userId);
        if (!user) continue;
        if (
          await send({
            template,
            to: user.email,
            data: data(user),
            idempotencyKey: `${idempotencyKey}:${userId.toHexString()}`,
            userId,
            workspaceId: wsId,
          })
        ) {
          n++;
        }
      }
      return n;
    },

    /** Queues without failing the caller: a request never fails because an email couldn't queue. */
    sendQuietly<T extends EmailTemplate>(req: EmailRequest<T>): Promise<void> {
      return send(req).then(
        () => undefined,
        (err: unknown) => deps.logger.error({ err, template: req.template }, 'email not queued'),
      );
    },
  };
}

export type EmailOutbox = ReturnType<typeof createEmailOutbox>;
