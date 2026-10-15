import { meSchema } from '@pv/shared';
import { Types } from 'mongoose';
import { pino } from 'pino';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createLogMailer, createMailer, createResendMailer } from '../src/emails/mailer';
import { createEmailOutbox } from '../src/emails/outbox';
import { renderEmail, type EmailTemplate, type EmailTemplates } from '../src/emails/templates';
import { JobModel } from '../src/jobs/model';
import { EmailLogModel } from '../src/modules/emailLog/model';
import {
  FakeMailer,
  connectTestDb,
  deliverEmails,
  dropTestDb,
  makeTestApp,
  signUp,
  silentLogger,
} from './helpers';

beforeAll(() => connectTestDb('emails_test'));
afterAll(() => dropTestDb());

const logOf = (key: string) => EmailLogModel.findOne({ idempotencyKey: key }).lean();
const jobOf = (key: string) => JobModel.findOne({ dedupeKey: `email:${key}` }).lean();

describe('send_email job + email_log (7.3)', () => {
  const mailer = new FakeMailer();
  const outbox = createEmailOutbox({ logger: silentLogger });
  const request = (key: string, to = 'ada@example.com') => ({
    template: 'welcome' as const,
    to,
    data: { name: 'Ada', appLink: 'http://localhost:5173/app' },
    idempotencyKey: key,
  });

  beforeEach(() => {
    mailer.sent.length = 0;
    mailer.failures = [];
  });

  it('queues once per key, sends once, and records it in email_log', async () => {
    expect(await outbox.send(request('welcome:a'))).toBe(true);
    expect(await outbox.send(request('welcome:a'))).toBe(false);
    expect((await logOf('welcome:a'))?.status).toBe('queued');

    expect(await deliverEmails(mailer)).toBe(1);
    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0]).toMatchObject({
      template: 'welcome',
      to: 'ada@example.com',
      from: 'PromptVerse <test@example.com>',
      idempotencyKey: 'welcome:a',
      subject: 'Welcome to PromptVerse',
    });
    expect(await logOf('welcome:a')).toMatchObject({
      status: 'sent',
      driver: 'fake',
      resendId: 'fake_1',
      attempts: 1,
    });

    // Queued again after it was sent (a webhook redelivery, a retried finalize): nothing new.
    expect(await outbox.send(request('welcome:a'))).toBe(false);
    expect(await deliverEmails(mailer)).toBe(0);
    expect(mailer.sent).toHaveLength(1);
  });

  it('a revived job for a key already sent does not send again', async () => {
    await outbox.send(request('welcome:b'));
    await deliverEmails(mailer);
    await JobModel.updateOne(
      { dedupeKey: 'email:welcome:b' },
      { $set: { status: 'queued', runAt: new Date(0), attempts: 0 } },
    );
    await deliverEmails(mailer);
    expect(mailer.sent.filter((m) => m.idempotencyKey === 'welcome:b')).toHaveLength(1);
  });

  it('retries a transient failure, then sends', async () => {
    mailer.failures = ['transient'];
    await outbox.send(request('welcome:c'));
    await deliverEmails(mailer);
    expect(mailer.sent).toHaveLength(0);
    let job = await jobOf('welcome:c');
    expect(job?.status).toBe('queued');
    expect(job?.lastError).toMatch(/transient/);
    expect((await logOf('welcome:c'))?.error).toMatch(/transient/);

    await JobModel.updateOne({ _id: job?._id }, { $set: { runAt: new Date(0) } });
    await deliverEmails(mailer);
    job = await jobOf('welcome:c');
    expect(job?.status).toBe('done');
    expect(await logOf('welcome:c')).toMatchObject({ status: 'sent', attempts: 2, error: null });
  });

  it('a permanent failure fails at once and is logged as failed', async () => {
    mailer.failures = ['permanent'];
    await outbox.send(request('welcome:d', 'bounce@example.com'));
    await deliverEmails(mailer);
    expect((await jobOf('welcome:d'))?.status).toBe('failed');
    expect(await logOf('welcome:d')).toMatchObject({ status: 'failed' });
  });

  it('gives up after the last attempt', async () => {
    await outbox.send(request('welcome:e'));
    await JobModel.updateOne({ dedupeKey: 'email:welcome:e' }, { $set: { maxAttempts: 2 } });
    mailer.failures = ['transient', 'transient'];
    await deliverEmails(mailer);
    await JobModel.updateOne({ dedupeKey: 'email:welcome:e' }, { $set: { runAt: new Date(0) } });
    await deliverEmails(mailer);
    expect((await jobOf('welcome:e'))?.status).toBe('failed');
    expect((await logOf('welcome:e'))?.status).toBe('failed');
  });

  it('forgets the email data (one-time links) once the job is finished', async () => {
    await outbox.send({
      template: 'reset_password',
      to: 'ada@example.com',
      data: { name: 'Ada', link: 'http://localhost:5173/reset-password?token=secret123' },
      idempotencyKey: 'reset:x',
    });
    expect(JSON.stringify(await jobOf('reset:x'))).toContain('secret123');
    await deliverEmails(mailer);
    expect(mailer.sent[0]?.text).toContain('secret123');
    const job = await jobOf('reset:x');
    expect(job?.status).toBe('done');
    expect(JSON.stringify(job)).not.toContain('secret123');
    // email_log never holds a body.
    expect(JSON.stringify(await logOf('reset:x'))).not.toContain('secret123');
  });
});

describe('opt-outs (10 § Opt-out)', () => {
  const t = makeTestApp({ deliverEmails: false });

  it('PATCH /me turns off run summaries and low-credit warnings; essentials still send', async () => {
    const { agent, me } = await signUp(t.app);
    expect(me.user.emailPrefs).toEqual({ runCompleted: true, lowCredits: true });
    const patched = meSchema.parse(
      (
        await agent
          .patch('/api/me')
          .send({ emailPrefs: { lowCredits: false } })
          .expect(200)
      ).body,
    );
    expect(patched.user.emailPrefs).toEqual({ runCompleted: true, lowCredits: false });

    const userId = new Types.ObjectId(me.user.id);
    const base = { to: me.user.email, userId };
    await t.services.emails.send({
      ...base,
      template: 'low_credits',
      data: { name: 'x', balance: 3, allowance: 0, billingLink: 'b', settingsLink: 's' },
      idempotencyKey: `low:optout:${me.user.id}`,
    });
    await t.services.emails.send({
      ...base,
      template: 'payment_failed',
      data: { name: 'x', billingLink: 'b' },
      idempotencyKey: `payfail:optout:${me.user.id}`,
    });
    await deliverEmails(t.mailer);
    expect((await logOf(`low:optout:${me.user.id}`))?.status).toBe('suppressed');
    expect((await logOf(`payfail:optout:${me.user.id}`))?.status).toBe('sent');
    expect(t.mailer.sent.map((m) => m.template)).toContain('payment_failed');
    expect(t.mailer.sent.map((m) => m.template)).not.toContain('low_credits');
  });
});

describe('drivers', () => {
  it('picks Resend only when RESEND_API_KEY is set (and EMAIL_DRIVER is not log)', () => {
    const opts = { production: false };
    expect(createMailer({}, silentLogger, opts).driver).toBe('log');
    expect(createMailer({ RESEND_API_KEY: 're_x' }, silentLogger, opts).driver).toBe('resend');
    expect(
      createMailer({ RESEND_API_KEY: 're_x', EMAIL_DRIVER: 'log' }, silentLogger, opts).driver,
    ).toBe('log');
  });

  it('resend: posts the email with the idempotency key; 429/5xx retry, other 4xx are permanent', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    let status = 200;
    const fetchStub = (url: string, init?: RequestInit) => {
      calls.push({ url, init: init ?? {} });
      const body = status === 200 ? { id: 'em_123' } : { message: 'nope' };
      return Promise.resolve(new Response(JSON.stringify(body), { status }));
    };
    const resend = createResendMailer('re_test', { fetch: fetchStub as typeof fetch });
    const message = {
      ...renderEmail('welcome', 'ada@example.com', { name: 'Ada', appLink: 'https://x/app' }),
      from: 'PromptVerse <noreply@example.com>',
      idempotencyKey: 'welcome:1',
    };
    expect(await resend.send(message)).toEqual({ id: 'em_123' });
    const call = calls[0];
    expect(call?.url).toBe('https://api.resend.com/emails');
    const headers = call?.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer re_test');
    expect(headers['Idempotency-Key']).toBe('welcome:1');
    expect(JSON.parse(call?.init.body as string)).toMatchObject({
      from: 'PromptVerse <noreply@example.com>',
      to: ['ada@example.com'],
      subject: 'Welcome to PromptVerse',
    });

    status = 429;
    await expect(resend.send(message)).rejects.toMatchObject({ permanent: false });
    status = 503;
    await expect(resend.send(message)).rejects.toMatchObject({ permanent: false });
    status = 422;
    await expect(resend.send(message)).rejects.toMatchObject({ permanent: true });
  });

  it('log: withholds bodies with one-time links in production', async () => {
    const lines: string[] = [];
    const logger = pino({ level: 'info' }, { write: (l: string) => void lines.push(l) });
    const message = {
      ...renderEmail('verify_email', 'ada@example.com', {
        name: 'Ada',
        link: 'https://x?token=s3',
      }),
      from: 'f',
      idempotencyKey: 'verify:1',
    };
    await createLogMailer(logger, { production: true }).send(message);
    await createLogMailer(logger, { production: false }).send(message);
    expect(lines[0]).not.toContain('token=s3');
    expect(lines[1]).toContain('token=s3');
  });
});

describe('templates (7.4)', () => {
  const schedule = {
    name: 'Ada',
    brandName: 'Acme <Analytics>',
    scheduleLabel: 'Weekly check',
    timing: 'Weekly on Monday at 09:00 America/Toronto',
    timezone: 'America/Toronto',
    platforms: ['ChatGPT', 'Gemini'],
    prompts: 'All active prompts',
    creditsPerRun: 20,
    nextRunAt: '2026-10-19T13:00:00.000Z',
    scheduleLink: 'https://app.example/app/brands/b1/schedules',
  };
  const samples: { [T in EmailTemplate]: EmailTemplates[T] } = {
    verify_email: { name: 'Ada', link: 'https://app.example/verify-email?token=abc' },
    reset_password: { name: 'Ada', link: 'https://app.example/reset-password?token=abc' },
    welcome: { name: 'Ada', appLink: 'https://app.example/app' },
    schedule_created: schedule,
    schedule_updated: { ...schedule, changes: ['timing', 'platforms'] },
    scheduled_run_completed: {
      name: 'Ada',
      brandName: 'Acme',
      scheduleLabel: '',
      visibilityPct: 42.5,
      deltaPts: -3.1,
      answered: 40,
      mentioned: 17,
      citedPct: 10,
      avgRank: 2.4,
      failed: 2,
      refunded: 2,
      runLink: 'https://app.example/app/runs/r1',
      settingsLink: 'https://app.example/app/settings',
    },
    run_skipped_low_credits: {
      name: 'Ada',
      brandName: 'Acme',
      scheduleLabel: 'Daily',
      needed: 20,
      balance: 5,
      skipsInARow: 2,
      billingLink: 'https://app.example/app/billing',
      scheduleLink: 'https://app.example/s',
    },
    schedule_paused: {
      name: 'Ada',
      brandName: 'Acme',
      scheduleLabel: 'Daily',
      billingLink: 'https://app.example/app/billing',
      scheduleLink: 'https://app.example/s',
    },
    schedule_platforms_dropped: {
      name: 'Ada',
      brandName: 'Acme',
      scheduleLabel: 'Daily',
      dropped: ['Claude'],
      kept: ['ChatGPT'],
      billingLink: 'https://app.example/app/billing',
      scheduleLink: 'https://app.example/s',
    },
    low_credits: {
      name: 'Ada',
      balance: 8,
      allowance: 150,
      billingLink: 'https://app.example/app/billing',
      settingsLink: 'https://app.example/app/settings',
    },
    payment_failed: { name: 'Ada', billingLink: 'https://app.example/app/billing' },
  };

  it.each(Object.keys(samples) as EmailTemplate[])(
    '%s renders HTML and a plain-text fallback with the same link',
    (template) => {
      const m = renderEmail(template, 'ada@example.com', samples[template] as never);
      expect(m.subject.length).toBeGreaterThan(5);
      expect(m.html).toMatch(/^<!doctype html>/);
      expect(m.text).toContain('Hi Ada,');
      const links = m.text.match(/https:\/\/app\.example\/[^\s)]*/g) ?? [];
      expect(links.length).toBeGreaterThan(0);
      for (const link of links) expect(m.html).toContain(link.replace(/&/g, '&amp;'));
      expect(m.hasSecretLink === true).toBe(
        template === 'verify_email' || template === 'reset_password',
      );
    },
  );

  it('escapes what users typed', () => {
    const m = renderEmail('schedule_created', 'a@example.com', schedule);
    expect(m.html).toContain('Acme &lt;Analytics&gt;');
    expect(m.html).not.toContain('<Analytics>');
  });

  it('shows the next run in the schedule’s own time zone', () => {
    const m = renderEmail('schedule_created', 'a@example.com', schedule);
    expect(m.text).toContain('Next run: Monday 19 October 2026 at 09:00 (America/Toronto)');
  });

  it('says how the run moved', () => {
    const m = renderEmail(
      'scheduled_run_completed',
      'a@example.com',
      samples.scheduled_run_completed,
    );
    expect(m.subject).toBe('Acme: 42.5% AI visibility in your scheduled report');
    expect(m.text).toContain('Change: -3.1 pts vs the previous run');
    expect(m.text).toContain('Failed checks: 2 (2 credits refunded)');
  });
});
