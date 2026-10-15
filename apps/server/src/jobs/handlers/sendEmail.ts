import { retryDecision } from '@pv/engine';
import type { Logger } from '../../config/logger';
import { EmailSendError, type Mailer } from '../../emails/mailer';
import type { SendEmailPayload } from '../../emails/outbox';
import {
  OPTIONAL_TEMPLATES,
  isEmailTemplate,
  renderEmail,
  type EmailTemplates,
} from '../../emails/templates';
import { emailLogRepo } from '../../modules/emailLog/repo';
import { usersRepo } from '../../modules/users/repo';
import { jobsRepo, type JobDoc } from '../repo';
import type { JobHandler, JobOutcome } from '../types';
import { ABANDONED, DONE } from '../types';

const errorText = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/**
 * The `send_email` job (10 § Email): render the template, check the opt-out, send through the
 * driver with the idempotency key, and record the outcome in `email_log`. A key already sent is
 * not sent again (a job revived or duplicated by hand). Failed sends retry with the queue's
 * transient backoff; permanent ones (a rejected address) fail at once.
 */
export function createSendEmailHandler(deps: {
  mailer: Mailer;
  from: string;
  logger: Logger;
}): JobHandler {
  /** Drops the rendered data (links with one-time tokens) once the job is finished with it. */
  const forget = (job: JobDoc) => jobsRepo.redactPayload(job._id, 'data');

  return {
    type: 'send_email',

    async run({ job, leaseId, signal }): Promise<JobOutcome> {
      const payload = job.payload as unknown as SendEmailPayload;
      const key = payload.idempotencyKey;
      if (!isEmailTemplate(payload.template)) {
        await emailLogRepo.markFinal(key, 'failed', `unknown template ${payload.template}`);
        return { kind: 'failed', error: `unknown template ${payload.template}` };
      }

      const logged = await emailLogRepo.findByKey(key);
      if (logged?.status === 'sent' || logged?.status === 'suppressed') {
        await forget(job);
        return DONE;
      }

      const pref = OPTIONAL_TEMPLATES[payload.template];
      if (pref && payload.userId) {
        const user = await usersRepo.findById(payload.userId);
        if (user?.emailPrefs?.[pref] === false) {
          await emailLogRepo.markFinal(key, 'suppressed', 'opted out');
          await forget(job);
          return DONE;
        }
      }

      const message = renderEmail(
        payload.template,
        payload.to,
        payload.data as unknown as EmailTemplates[typeof payload.template],
      );
      // Last look at the lease before the one side effect that can't be fenced.
      if (signal.aborted || !(await jobsRepo.holds(job._id, leaseId))) return ABANDONED;

      try {
        const sent = await deps.mailer.send({ ...message, from: deps.from, idempotencyKey: key });
        await emailLogRepo.markSent(key, deps.mailer.driver, sent.id);
      } catch (err) {
        const error = errorText(err);
        await emailLogRepo.markAttemptFailed(key, error);
        const permanent = err instanceof EmailSendError && err.permanent;
        if (permanent || job.attempts >= job.maxAttempts) {
          deps.logger.error({ err, template: payload.template, key }, 'email not sent');
          return { kind: 'failed', error };
        }
        deps.logger.warn({ err, template: payload.template, key }, 'email send failed; retrying');
        return {
          kind: 'retry',
          delayMs: retryDecision('transient', job.attempts).delayMs,
          refundAttempt: false,
          error,
        };
      }
      await forget(job);
      return DONE;
    },

    async onGiveUp(job, error) {
      const payload = job.payload as unknown as SendEmailPayload;
      await emailLogRepo.markFinal(payload.idempotencyKey, 'failed', error);
      await forget(job);
    },
  };
}
