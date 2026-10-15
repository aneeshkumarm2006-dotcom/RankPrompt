import type { Logger } from '../config/logger';

/**
 * Email drivers (10 § Email, D-018). The `send_email` job renders a template and hands the result
 * to one driver: `log` by default, `resend` only when `RESEND_API_KEY` is set. Nothing else in
 * the app sends email directly; it goes through the outbox (`outbox.ts`).
 */
export interface EmailMessage {
  template: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Links in the body that carry a one-time token (verify, reset). */
  hasSecretLink?: boolean;
}

export interface OutgoingEmail extends EmailMessage {
  from: string;
  /** Sent as Resend's `Idempotency-Key`, so a retried job can't send the email twice. */
  idempotencyKey: string;
}

export interface Mailer {
  /** `log` or `resend`, recorded in `email_log`. */
  readonly driver: string;
  /** Resolves with the provider's message id (null for the log driver). Throws `EmailSendError`. */
  send(message: OutgoingEmail): Promise<{ id: string | null }>;
}

/** A failed send. `permanent` errors (a bad address, a rejected sender) are not retried. */
export class EmailSendError extends Error {
  override name = 'EmailSendError';
  constructor(
    message: string,
    readonly permanent: boolean,
  ) {
    super(message);
  }
}

/**
 * The default driver: writes the email to the log. Outside production the whole text body is
 * logged, so a local verify or reset link can be copied from the console. In production, bodies
 * holding a one-time link are not logged (they'd be a credential in the logs); set
 * `RESEND_API_KEY` for those.
 */
export function createLogMailer(logger: Logger, opts: { production: boolean }): Mailer {
  return {
    driver: 'log',
    send(message) {
      const redact = opts.production && message.hasSecretLink === true;
      logger.info(
        {
          email: {
            template: message.template,
            to: message.to,
            subject: message.subject,
            idempotencyKey: message.idempotencyKey,
            ...(redact ? {} : { body: message.text }),
          },
        },
        redact
          ? 'email (log driver; body withheld: it contains a one-time link)'
          : 'email (log driver)',
      );
      return Promise.resolve({ id: null });
    },
  };
}

const RESEND_URL = 'https://api.resend.com/emails';
const RESEND_TIMEOUT_MS = 15_000;

/**
 * Resend's HTTP API (no SDK: one POST). Each email carries its idempotency key, which Resend keeps
 * for 24 h, so a job retried after a lost response doesn't send twice. 429, 409 (a concurrent
 * request with the same key) and 5xx are retried; other 4xx are permanent.
 */
export function createResendMailer(
  apiKey: string,
  opts: { fetch?: typeof fetch; url?: string } = {},
): Mailer {
  const doFetch = opts.fetch ?? fetch;
  return {
    driver: 'resend',
    async send(message) {
      let res: Response;
      try {
        res = await doFetch(opts.url ?? RESEND_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': message.idempotencyKey,
          },
          body: JSON.stringify({
            from: message.from,
            to: [message.to],
            subject: message.subject,
            html: message.html,
            text: message.text,
          }),
          signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
        });
      } catch (err) {
        throw new EmailSendError(
          `resend request failed: ${err instanceof Error ? err.message : String(err)}`,
          false,
        );
      }
      const body = (await res.json().catch(() => ({}))) as { id?: unknown; message?: unknown };
      if (!res.ok) {
        const detail = typeof body.message === 'string' ? body.message.slice(0, 200) : '';
        const retryable = res.status === 429 || res.status === 409 || res.status >= 500;
        throw new EmailSendError(`resend ${res.status} ${detail}`.trim(), !retryable);
      }
      return { id: typeof body.id === 'string' ? body.id : null };
    },
  };
}

/** `RESEND_API_KEY` picks Resend unless `EMAIL_DRIVER=log` forces the log driver (D-018). */
export function createMailer(
  env: { EMAIL_DRIVER?: 'log' | 'resend' | undefined; RESEND_API_KEY?: string | undefined },
  logger: Logger,
  opts: { production: boolean },
): Mailer {
  if (env.RESEND_API_KEY && env.EMAIL_DRIVER !== 'log') {
    return createResendMailer(env.RESEND_API_KEY);
  }
  return createLogMailer(logger, opts);
}
