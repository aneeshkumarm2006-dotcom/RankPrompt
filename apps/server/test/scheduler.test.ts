import { scheduleSchema, type CreateScheduleInput, type Platform, type Schedule } from '@pv/shared';
import { Types } from 'mongoose';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { noopReporter } from '../src/config/sentry';
import { withTransaction } from '../src/db/transaction';
import { Scheduler } from '../src/jobs/scheduler';
import { adminAdjust } from '../src/modules/credits/service';
import { EmailLogModel } from '../src/modules/emailLog/model';
import { RunModel } from '../src/modules/runs/model';
import { ScheduleModel } from '../src/modules/schedules/model';
import { schedulesRepo } from '../src/modules/schedules/repo';
import { slotRunKey } from '../src/modules/schedules/service';
import { WorkspaceModel } from '../src/modules/workspaces/model';
import {
  connectTestDb,
  deliverEmails,
  dropTestDb,
  makeTestApp,
  signUp,
  silentLogger,
  type Client,
} from './helpers';
import {
  brandWithPrompts,
  createRun,
  expectLedgerBalanced,
  testWorker,
  waitForRun,
} from './runHelpers';

/**
 * Fake-clock integration tests (7.5, 10): the tick is driven by hand with an explicit `now`, and
 * the API computes `nextRunAt` from the same clock. Runs, skips, auto-pause and the emails (as
 * `email_log` rows) are checked against the real queue, ledger and worker.
 */

let clock = new Date('2026-10-15T12:00:00Z'); // a Thursday
const t = makeTestApp({ now: () => clock });
const { app, mailer, services } = t;
const newScheduler = () =>
  new Scheduler({
    schedules: services.schedules,
    logger: silentLogger,
    reporter: noopReporter,
    tickMs: 0,
  });
const scheduler = newScheduler();
const tickAt = (iso: string) => {
  clock = new Date(iso);
  return scheduler.tick(clock);
};

beforeAll(() => connectTestDb('scheduler_test'));
afterAll(() => dropTestDb());
afterEach(async () => {
  // Each test's schedules stop here, so a later test's clock can't run them.
  await ScheduleModel.deleteMany({}).setOptions({ crossWorkspace: true });
  clock = new Date('2026-10-15T12:00:00Z');
});

const SYSTEM = { crossWorkspace: true };
const runsOf = (scheduleId: string) =>
  RunModel.find({ scheduleId: new Types.ObjectId(scheduleId) })
    .setOptions(SYSTEM)
    .sort({ createdAt: 1 })
    .lean();
const scheduleDoc = async (id: string) => {
  const s = await schedulesRepo.findAnyById(id);
  if (!s) throw new Error('schedule gone');
  return s;
};
const emailRows = (prefix: string) =>
  EmailLogModel.find({ idempotencyKey: new RegExp(`^${prefix}`) }).lean();

async function account(opts: { prompts?: number; tier?: 'free' | 'pro' } = {}) {
  const user = await signUp(app);
  if (opts.tier === 'pro') {
    await WorkspaceModel.updateOne({ _id: user.me.workspace.id }, { $set: { 'plan.tier': 'pro' } });
  }
  const brand = await brandWithPrompts(user.agent, opts.prompts ?? 1);
  return { ...user, ...brand, workspaceId: user.me.workspace.id };
}

async function schedule(
  agent: Client,
  brandId: string,
  over: Partial<CreateScheduleInput> = {},
): Promise<Schedule> {
  const body: CreateScheduleInput = {
    brandId,
    frequency: 'weekly',
    weekday: 1,
    hour: 9,
    timezone: 'UTC',
    platforms: ['chatgpt'],
    promptSelection: { mode: 'all_active', promptIds: [] },
    country: 'US',
    language: 'en',
    scope: 'national',
    ...over,
  };
  return scheduleSchema.parse((await agent.post('/api/schedules').send(body).expect(201)).body);
}

/** Sets the purchased bucket to `n` credits (plan credits are 0 on the free plan). */
async function setBalance(workspaceId: string, n: number) {
  const ws = await WorkspaceModel.findById(workspaceId).lean();
  const delta = n - (ws?.credits.purchased ?? 0);
  if (delta === 0) return;
  await withTransaction((session) =>
    adminAdjust(session, {
      workspaceId: new Types.ObjectId(workspaceId),
      bucket: 'purchased',
      delta,
      note: 'test',
    }),
  );
}

/** Runs the worker until the run is final (finalize also queues the summary email). */
async function finish(agent: Client, runId: string) {
  const worker = testWorker({ mailer, notifyRunDone: services.notifyRunDone });
  worker.start();
  try {
    return await waitForRun(agent, runId);
  } finally {
    await worker.drain(5_000);
  }
}

describe('daily schedules', () => {
  it('runs each slot once, advances nextRunAt, and emails a summary with the change', async () => {
    const a = await account({ prompts: 2, tier: 'pro' });
    const s = await schedule(a.agent, a.brandId, {
      frequency: 'daily',
      platforms: ['chatgpt', 'gemini'],
    });
    expect(s.nextRunAt).toBe('2026-10-16T09:00:00.000Z');

    await tickAt('2026-10-16T08:59:00Z');
    expect(await runsOf(s.id)).toHaveLength(0);

    await tickAt('2026-10-16T09:00:20Z');
    const [first] = await runsOf(s.id);
    expect(first).toMatchObject({
      trigger: 'scheduled',
      createdBy: null,
      idempotencyKey: `schedule:${s.id}:2026-10-16T09:00:00.000Z`,
      credits: { reserved: 4 },
    });
    let doc = await scheduleDoc(s.id);
    expect(doc.nextRunAt?.toISOString()).toBe('2026-10-17T09:00:00.000Z');
    expect(doc.lastRunId?.toHexString()).toBe(first?._id.toHexString());
    expect(doc.inFlight).toBeNull();

    // The same moment again (another tick, or the other instance): nothing new.
    await tickAt('2026-10-16T09:00:40Z');
    expect(await runsOf(s.id)).toHaveLength(1);

    await finish(a.agent, String(first?._id));
    const [summary] = await mailer.waitFor('scheduled_run_completed', 1, a.email);
    expect(summary?.text).toContain('No earlier run to compare');
    expect(summary?.text).toContain(`/app/runs/${String(first?._id)}`);

    await tickAt('2026-10-17T09:01:00Z');
    const runs = await runsOf(s.id);
    expect(runs).toHaveLength(2);
    await finish(a.agent, String(runs[1]?._id));
    const summaries = await mailer.waitFor('scheduled_run_completed', 2, a.email);
    expect(summaries[1]?.text).toMatch(/pts vs the previous run/);

    // Exactly one summary row per run, both sent.
    const rows = await emailRows('run_done:');
    const mine = rows.filter((r) => r.to === a.email);
    expect(mine.map((r) => r.status)).toEqual(['sent', 'sent']);
    doc = await scheduleDoc(s.id);
    expect(doc.lastRunId?.toHexString()).toBe(runs[1]?._id.toHexString());
    await expectLedgerBalanced(a.workspaceId);
  });

  it('after downtime, catches up once and schedules from now (no replay of missed slots)', async () => {
    const a = await account({ tier: 'pro' });
    const s = await schedule(a.agent, a.brandId, { frequency: 'daily' });
    // Down from the 16th to the 21st at 15:00: five slots missed.
    await tickAt('2026-10-21T15:00:00Z');
    const runs = await runsOf(s.id);
    expect(runs).toHaveLength(1);
    expect(runs[0]?.idempotencyKey).toBe(`schedule:${s.id}:2026-10-16T09:00:00.000Z`);
    expect((await scheduleDoc(s.id)).nextRunAt?.toISOString()).toBe('2026-10-22T09:00:00.000Z');
    await tickAt('2026-10-21T15:01:00Z');
    expect(await runsOf(s.id)).toHaveLength(1);
  });

  it('a user who turned summaries off gets none (email_log says suppressed)', async () => {
    const a = await account({ tier: 'pro' });
    await a.agent
      .patch('/api/me')
      .send({ emailPrefs: { runCompleted: false } })
      .expect(200);
    const s = await schedule(a.agent, a.brandId, { frequency: 'daily' });
    await tickAt('2026-10-16T09:00:00Z');
    const [run] = await runsOf(s.id);
    await finish(a.agent, String(run?._id));
    await deliverEmails(mailer);
    const [row] = await emailRows(`run_done:${String(run?._id)}`);
    expect(row?.status).toBe('suppressed');
    expect(
      mailer.sent.some((m) => m.idempotencyKey.startsWith(`run_done:${String(run?._id)}`)),
    ).toBe(false);
  });
});

describe('weekly schedules', () => {
  it('runs on the weekday at the local hour, across the end of DST', async () => {
    const a = await account();
    const s = await schedule(a.agent, a.brandId, { timezone: 'America/Toronto' });
    expect(s.nextRunAt).toBe('2026-10-19T13:00:00.000Z'); // Monday 09:00 EDT

    await tickAt('2026-10-19T13:00:05Z');
    await tickAt('2026-10-22T13:00:00Z'); // Thursday: nothing due
    await tickAt('2026-10-26T13:00:05Z');
    // Toronto falls back on 1 November: 09:00 is now 14:00 UTC.
    expect((await scheduleDoc(s.id)).nextRunAt?.toISOString()).toBe('2026-11-02T14:00:00.000Z');
    await tickAt('2026-11-02T13:30:00Z');
    expect(await runsOf(s.id)).toHaveLength(2);
    await tickAt('2026-11-02T14:00:01Z');
    expect((await runsOf(s.id)).map((r) => r.idempotencyKey)).toEqual([
      `schedule:${s.id}:2026-10-19T13:00:00.000Z`,
      `schedule:${s.id}:2026-10-26T13:00:00.000Z`,
      `schedule:${s.id}:2026-11-02T14:00:00.000Z`,
    ]);
  });
});

describe('two instances', () => {
  it('ticking at the same moment, every due slot gets exactly one run', async () => {
    const users = await Promise.all([account(), account(), account()]);
    const made: Schedule[] = [];
    for (const u of users) {
      made.push(await schedule(u.agent, u.brandId));
      made.push(await schedule(u.agent, u.brandId, { label: 'second', hour: 8 }));
    }
    clock = new Date('2026-10-19T10:00:00Z');
    const [x, y] = await Promise.all([newScheduler().tick(clock), newScheduler().tick(clock)]);
    expect((x?.claimed ?? 0) + (y?.claimed ?? 0)).toBe(made.length);
    for (const s of made) expect(await runsOf(s.id)).toHaveLength(1);
    for (const u of users) await expectLedgerBalanced(u.workspaceId);
  });
});

describe('low credits and auto-pause (F-27)', () => {
  it('skips with an email, pauses after 3 skips in a row, and recovers after a top-up', async () => {
    const a = await account({ prompts: 2 });
    const s = await schedule(a.agent, a.brandId, { platforms: ['chatgpt', 'gemini'] });
    await setBalance(a.workspaceId, 3); // a run needs 4

    await tickAt('2026-10-19T09:00:00Z');
    expect(await runsOf(s.id)).toHaveLength(0);
    let doc = await scheduleDoc(s.id);
    expect(doc).toMatchObject({ isActive: true, consecutiveSkips: 1 });
    expect(doc.lastSkip?.reason).toBe('insufficient_credits');
    const [skip] = await mailer.waitFor('run_skipped_low_credits', 1, a.email);
    expect(skip?.text).toContain('needs 4 credits and your balance is 3');
    expect(skip?.idempotencyKey).toBe(`skip:${s.id}:2026-10-19T09:00:00.000Z:${a.me.user.id}`);

    // A second tick at the same slot doesn't count it again.
    await tickAt('2026-10-19T09:00:30Z');
    expect((await scheduleDoc(s.id)).consecutiveSkips).toBe(1);

    await tickAt('2026-10-26T09:00:00Z');
    expect((await scheduleDoc(s.id)).consecutiveSkips).toBe(2);
    await tickAt('2026-11-02T09:00:00Z');
    doc = await scheduleDoc(s.id);
    expect(doc).toMatchObject({
      isActive: false,
      pausedReason: 'insufficient_credits',
      consecutiveSkips: 3,
      nextRunAt: null,
    });
    const [paused] = await mailer.waitFor('schedule_paused', 1, a.email);
    expect(paused?.idempotencyKey).toBe(`paused:${s.id}:2026-11-02:${a.me.user.id}`);
    expect(await mailer.waitFor('run_skipped_low_credits', 3, a.email)).toHaveLength(3);

    // Paused: later slots do nothing and send nothing.
    await tickAt('2026-11-09T09:00:00Z');
    expect(await runsOf(s.id)).toHaveLength(0);
    await deliverEmails(mailer);
    expect(
      mailer.sent.filter((m) => m.template === 'run_skipped_low_credits' && m.to === a.email),
    ).toHaveLength(3);

    // Top up and resume: the next slot runs and the streak resets.
    await setBalance(a.workspaceId, 20);
    const resumed = scheduleSchema.parse(
      (await a.agent.post(`/api/schedules/${s.id}/resume`).expect(200)).body,
    );
    expect(resumed).toMatchObject({ consecutiveSkips: 0, nextRunAt: '2026-11-16T09:00:00.000Z' });
    await tickAt('2026-11-16T09:00:00Z');
    expect(await runsOf(s.id)).toHaveLength(1);
    expect(await scheduleDoc(s.id)).toMatchObject({ consecutiveSkips: 0, lastSkip: null });
    await expectLedgerBalanced(a.workspaceId);
  });

  it('a run that leaves the balance low sends low_credits once per period', async () => {
    const a = await account({ prompts: 9, tier: 'pro' });
    const platforms: Platform[] = ['chatgpt', 'perplexity', 'gemini', 'claude', 'google_aio'];
    const s = await schedule(a.agent, a.brandId, { platforms });
    // 50 signup credits − 45 = 5 left, under the 10-credit floor.
    await tickAt('2026-10-19T09:00:00Z');
    expect(await runsOf(s.id)).toHaveLength(1);
    const [low] = await mailer.waitFor('low_credits', 1, a.email);
    expect(low?.text).toContain('You have 5 credits left');
    // Another spend in the same period: no second warning.
    await createRun(a.agent, {
      brandId: a.brandId,
      promptIds: a.promptIds.slice(0, 1),
      platforms: ['chatgpt'],
    });
    await deliverEmails(mailer);
    expect(
      mailer.sent.filter((m) => m.template === 'low_credits' && m.to === a.email),
    ).toHaveLength(1);
    const [row] = await emailRows(`low:${a.workspaceId}:`);
    expect(row?.idempotencyKey).toMatch(new RegExp(`^low:${a.workspaceId}:\\d{4}-\\d{2}-01:`));
  });
});

describe('prompt selection at run time (10)', () => {
  it('all_active picks up prompts added later; fixed skips archived ids; none left is a no_prompts skip', async () => {
    const a = await account({ prompts: 2 });
    const all = await schedule(a.agent, a.brandId);
    const fixed = await schedule(a.agent, a.brandId, {
      label: 'fixed',
      promptSelection: { mode: 'fixed', promptIds: a.promptIds },
    });
    await a.agent
      .post(`/api/brands/${a.brandId}/prompts`)
      .send({ prompts: [{ text: 'A prompt added after the schedule?', category: 'Tools' }] })
      .expect(201);
    await a.agent.delete(`/api/prompts/${a.promptIds[0]}`).expect(204);

    await tickAt('2026-10-19T09:00:00Z');
    const [allRun] = await runsOf(all.id);
    const [fixedRun] = await runsOf(fixed.id);
    expect(allRun?.promptIds).toHaveLength(2); // one archived, one added
    expect(fixedRun?.promptIds.map(String)).toEqual([a.promptIds[1]]);

    await a.agent.delete(`/api/prompts/${a.promptIds[1]}`).expect(204);
    await tickAt('2026-10-26T09:00:00Z');
    expect(await runsOf(fixed.id)).toHaveLength(1);
    const doc = await scheduleDoc(fixed.id);
    expect(doc).toMatchObject({ isActive: true, consecutiveSkips: 0 });
    expect(doc.lastSkip?.reason).toBe('no_prompts');
    expect(await runsOf(all.id)).toHaveLength(2);
  });

  it('an archived brand pauses its schedules, and the tick leaves them alone', async () => {
    const a = await account();
    const s = await schedule(a.agent, a.brandId);
    await a.agent.delete(`/api/brands/${a.brandId}`).expect(204);
    await tickAt('2026-10-19T09:00:00Z');
    expect(await runsOf(s.id)).toHaveLength(0);
    expect(await scheduleDoc(s.id)).toMatchObject({
      isActive: false,
      pausedReason: 'brand_archived',
    });
  });
});

describe('crash recovery', () => {
  it('a claimed slot whose instance died is taken over and runs once', async () => {
    const a = await account();
    const s = await schedule(a.agent, a.brandId);
    const due = await scheduleDoc(s.id);
    const slot = due.nextRunAt;
    if (!slot) throw new Error('no slot');
    // An instance claims the slot at 09:00 and dies before doing anything.
    const claimed = await schedulesRepo.claim(
      due,
      new Date('2026-10-26T09:00:00Z'),
      new Date('2026-10-19T09:05:00Z'),
    );
    expect(claimed?.inFlight?.slot.toISOString()).toBe(slot.toISOString());

    // Before its claim runs out, nobody touches it.
    await tickAt('2026-10-19T09:04:00Z');
    expect(await runsOf(s.id)).toHaveLength(0);
    const stats = await tickAt('2026-10-19T09:06:00Z');
    expect(stats.recovered).toBe(1);
    const runs = await runsOf(s.id);
    expect(runs.map((r) => r.idempotencyKey)).toEqual([slotRunKey(due._id, slot)]);
    expect((await scheduleDoc(s.id)).inFlight).toBeNull();
  });

  it('a slot whose run was created just before the crash is not run twice', async () => {
    const a = await account();
    const s = await schedule(a.agent, a.brandId);
    const due = await scheduleDoc(s.id);
    const slot = due.nextRunAt;
    if (!slot) throw new Error('no slot');
    const claimed = await schedulesRepo.claim(
      due,
      new Date('2026-10-26T09:00:00Z'),
      new Date('2026-10-19T09:05:00Z'),
    );
    if (!claimed) throw new Error('not claimed');
    // The run got created, then the instance died before marking the slot done.
    const brand = await import('../src/modules/brands/repo').then((m) =>
      m.brandsRepo.findActiveById({ workspaceId: a.workspaceId }, a.brandId),
    );
    const prompts = await import('../src/modules/prompts/repo').then((m) =>
      m.promptsRepo.listForBrand({ workspaceId: a.workspaceId }, a.brandId, false),
    );
    if (!brand) throw new Error('no brand');
    await services.runs.startRun({
      workspaceId: new Types.ObjectId(a.workspaceId),
      brand,
      prompts,
      platforms: ['chatgpt'],
      location: { country: 'US', city: null, language: 'en', scope: 'national' },
      trigger: 'scheduled',
      scheduleId: due._id,
      createdBy: null,
      idempotencyKey: slotRunKey(due._id, slot),
    });
    await tickAt('2026-10-19T09:06:00Z');
    expect(await runsOf(s.id)).toHaveLength(1);
    expect((await scheduleDoc(s.id)).inFlight).toBeNull();
    await expectLedgerBalanced(a.workspaceId);
  });
});

describe('credits are only ever spent through the ledger', () => {
  it('scheduled runs reserve with run_reserve rows like manual runs', async () => {
    const a = await account({ prompts: 2 });
    const s = await schedule(a.agent, a.brandId, { platforms: ['chatgpt', 'gemini'] });
    await tickAt('2026-10-19T09:00:00Z');
    const [run] = await runsOf(s.id);
    const ws = await WorkspaceModel.findById(a.workspaceId).lean();
    expect(ws?.credits.purchased).toBe(50 - 4);
    expect(run?.credits.split).toEqual({ plan: 0, purchased: 4 });
    await expectLedgerBalanced(a.workspaceId);
  });
});
