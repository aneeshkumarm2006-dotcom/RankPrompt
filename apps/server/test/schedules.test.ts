import {
  MAX_SCHEDULES_PER_BRAND,
  errorEnvelopeSchema,
  runSchema,
  scheduleListResponseSchema,
  scheduleSchema,
  type CreateScheduleInput,
  type Schedule,
} from '@pv/shared';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EmailLogModel } from '../src/modules/emailLog/model';
import { WorkspaceModel } from '../src/modules/workspaces/model';
import { connectTestDb, dropTestDb, makeTestApp, signUp, type Client } from './helpers';
import { brandWithPrompts, expectLedgerBalanced } from './runHelpers';

const CLOCK = new Date('2026-10-15T12:00:00Z'); // a Thursday
const t = makeTestApp({ now: () => CLOCK });
const { app, mailer } = t;

beforeAll(() => connectTestDb('schedules_test'));
afterAll(() => dropTestDb());

const codeOf = (body: unknown) => errorEnvelopeSchema.parse(body).error.code;

function weekly(brandId: string, over: Partial<CreateScheduleInput> = {}): CreateScheduleInput {
  return {
    brandId,
    label: 'Weekly check',
    frequency: 'weekly',
    weekday: 1,
    hour: 9,
    timezone: 'America/Toronto',
    platforms: ['chatgpt', 'gemini'],
    promptSelection: { mode: 'all_active', promptIds: [] },
    country: 'CA',
    language: 'en',
    scope: 'national',
    ...over,
  };
}

async function create(agent: Client, body: CreateScheduleInput): Promise<Schedule> {
  return scheduleSchema.parse((await agent.post('/api/schedules').send(body).expect(201)).body);
}

async function setup(prompts = 3) {
  const user = await signUp(app);
  const brand = await brandWithPrompts(user.agent, prompts);
  return { ...user, ...brand };
}

describe('POST /schedules', () => {
  it('creates a schedule with its next slot, cost per run and a confirmation email', async () => {
    const { agent, brandId, email } = await setup(3);
    const s = await create(agent, weekly(brandId));
    // Next Monday 09:00 Toronto (EDT, UTC−4).
    expect(s).toMatchObject({
      brandId,
      label: 'Weekly check',
      isActive: true,
      nextRunAt: '2026-10-19T13:00:00.000Z',
      weekday: 1,
      dayOfMonth: null,
      city: null,
      creditsPerRun: 6,
      consecutiveSkips: 0,
      lastRunId: null,
      lastSkip: null,
    });
    const [message] = await mailer.waitFor('schedule_created', 1, email);
    expect(message?.text).toContain('Next run: Monday 19 October 2026 at 09:00 (America/Toronto)');
    expect(message?.text).toContain('Credits per run: 6 credits');
    expect(await EmailLogModel.countDocuments({ idempotencyKey: `schedule_created:${s.id}` })).toBe(
      1,
    );

    const list = scheduleListResponseSchema.parse(
      (await agent.get(`/api/brands/${brandId}/schedules`).expect(200)).body,
    );
    expect(list.map((x) => x.id)).toEqual([s.id]);
  });

  it('clears day fields the frequency does not use', async () => {
    const { agent, brandId } = await setup(1);
    const s = await create(
      agent,
      weekly(brandId, { frequency: 'monthly', dayOfMonth: 1, weekday: 3, city: 'Toronto' }),
    );
    expect(s).toMatchObject({ weekday: null, dayOfMonth: 1, city: null });
    // 1 November: Toronto is back on EST (UTC−5) by 09:00.
    expect(s.nextRunAt).toBe('2026-11-01T14:00:00.000Z');
  });

  it('checks the plan, the time zone and the prompts', async () => {
    const { agent, brandId, promptIds } = await setup(2);
    const bad = async (body: CreateScheduleInput, status: number, code: string) => {
      const res = await agent.post('/api/schedules').send(body).expect(status);
      expect(codeOf(res.body)).toBe(code);
      return res.body as { error: { details?: { path: string }[] } };
    };
    // The free plan schedules weekly or monthly only (06).
    const daily = await bad(weekly(brandId, { frequency: 'daily' }), 400, 'VALIDATION_FAILED');
    expect(daily.error.details?.[0]?.path).toBe('frequency');
    await bad(weekly(brandId, { timezone: 'Mars/Olympus' }), 400, 'VALIDATION_FAILED');
    await bad(weekly(brandId, { weekday: null }), 400, 'VALIDATION_FAILED');
    await bad(
      weekly(brandId, { promptSelection: { mode: 'fixed', promptIds: [] } }),
      400,
      'VALIDATION_FAILED',
    );
    // An archived prompt can't be picked.
    const [first] = promptIds;
    await agent.delete(`/api/prompts/${first}`).expect(204);
    await bad(
      weekly(brandId, { promptSelection: { mode: 'fixed', promptIds: promptIds } }),
      400,
      'VALIDATION_FAILED',
    );
    await bad(weekly('0123456789abcdef01234567'), 404, 'NOT_FOUND');
  });

  it('allows daily schedules on a paid plan, and caps schedules per brand', async () => {
    const { agent, brandId, me } = await setup(1);
    await WorkspaceModel.updateOne({ _id: me.workspace.id }, { $set: { 'plan.tier': 'pro' } });
    const daily = await create(agent, weekly(brandId, { frequency: 'daily', hour: 7 }));
    expect(daily.nextRunAt).toBe('2026-10-16T11:00:00.000Z');
    for (let i = 1; i < MAX_SCHEDULES_PER_BRAND; i++) await create(agent, weekly(brandId));
    const res = await agent.post('/api/schedules').send(weekly(brandId)).expect(409);
    expect(codeOf(res.body)).toBe('CONFLICT');
  });
});

describe('PATCH /schedules/:id', () => {
  it('merges a partial patch, recomputes nextRunAt on a timing change and emails the change', async () => {
    const { agent, brandId, email } = await setup(2);
    const s = await create(agent, weekly(brandId));

    const labelOnly = scheduleSchema.parse(
      (await agent.patch(`/api/schedules/${s.id}`).send({ label: 'Renamed' }).expect(200)).body,
    );
    expect(labelOnly).toMatchObject({ label: 'Renamed', weekday: 1, nextRunAt: s.nextRunAt });

    const moved = scheduleSchema.parse(
      (await agent.patch(`/api/schedules/${s.id}`).send({ weekday: 5, hour: 18 }).expect(200)).body,
    );
    expect(moved).toMatchObject({ label: 'Renamed', weekday: 5, hour: 18 });
    expect(moved.nextRunAt).toBe('2026-10-16T22:00:00.000Z'); // Friday 18:00 EDT

    const updates = await mailer.waitFor('schedule_updated', 1, email);
    expect(updates).toHaveLength(1);
    expect(updates[0]?.text).toContain('(timing)');
  });

  it('checks the merged schedule as a whole', async () => {
    const { agent, brandId } = await setup(1);
    const s = await create(agent, weekly(brandId));
    // Monthly needs a day of the month; the stored schedule has none.
    const res = await agent.patch(`/api/schedules/${s.id}`).send({ frequency: 'monthly' });
    expect(res.status).toBe(400);
    expect(codeOf(res.body)).toBe('VALIDATION_FAILED');
    const ok = scheduleSchema.parse(
      (
        await agent
          .patch(`/api/schedules/${s.id}`)
          .send({ frequency: 'monthly', dayOfMonth: 15 })
          .expect(200)
      ).body,
    );
    expect(ok).toMatchObject({ frequency: 'monthly', dayOfMonth: 15, weekday: null });
  });
});

describe('pause, resume, delete', () => {
  it('pause clears nextRunAt; resume computes it from now and clears the skip streak', async () => {
    const { agent, brandId, me } = await setup(1);
    const s = await create(agent, weekly(brandId));
    const paused = scheduleSchema.parse(
      (await agent.post(`/api/schedules/${s.id}/pause`).expect(200)).body,
    );
    expect(paused).toMatchObject({ isActive: false, pausedReason: 'user', nextRunAt: null });
    // Pausing twice is fine.
    await agent.post(`/api/schedules/${s.id}/pause`).expect(200);

    const { ScheduleModel } = await import('../src/modules/schedules/model');
    await ScheduleModel.updateOne(
      { _id: s.id, workspaceId: me.workspace.id },
      { $set: { consecutiveSkips: 2 } },
    );
    const resumed = scheduleSchema.parse(
      (await agent.post(`/api/schedules/${s.id}/resume`).expect(200)).body,
    );
    expect(resumed).toMatchObject({
      isActive: true,
      pausedReason: null,
      consecutiveSkips: 0,
      nextRunAt: '2026-10-19T13:00:00.000Z',
    });

    await agent.delete(`/api/schedules/${s.id}`).expect(204);
    await agent.delete(`/api/schedules/${s.id}`).expect(404);
  });

  it('archiving the brand pauses its schedules and makes them read-only', async () => {
    const { agent, brandId } = await setup(1);
    const s = await create(agent, weekly(brandId));
    await agent.delete(`/api/brands/${brandId}`).expect(204);
    const [listed] = scheduleListResponseSchema.parse(
      (await agent.get(`/api/brands/${brandId}/schedules`).expect(200)).body,
    );
    expect(listed).toMatchObject({ isActive: false, pausedReason: 'brand_archived' });
    await agent.patch(`/api/schedules/${s.id}`).send({ hour: 3 }).expect(404);
    await agent.post(`/api/schedules/${s.id}/resume`).expect(404);
    await agent
      .post(`/api/schedules/${s.id}/run-now`)
      .set('Idempotency-Key', randomUUID())
      .expect(404);
  });
});

describe('POST /schedules/:id/run-now', () => {
  it("starts a run with the schedule's config and becomes its last run", async () => {
    const { agent, brandId, promptIds, me } = await setup(3);
    const s = await create(
      agent,
      weekly(brandId, {
        platforms: ['perplexity'],
        promptSelection: { mode: 'fixed', promptIds: promptIds.slice(0, 2) },
      }),
    );
    const key = randomUUID();
    const run = runSchema.parse(
      (await agent.post(`/api/schedules/${s.id}/run-now`).set('Idempotency-Key', key).expect(201))
        .body,
    );
    expect(run.credits.reserved).toBe(2);
    expect(run.trigger).toBe('manual');
    expect(run.scheduleId).toBe(s.id);
    expect(run.config.platforms).toEqual(['perplexity']);
    // A replay returns the same run.
    const again = await agent
      .post(`/api/schedules/${s.id}/run-now`)
      .set('Idempotency-Key', key)
      .expect(200);
    expect(runSchema.parse(again.body).id).toBe(run.id);

    const [listed] = scheduleListResponseSchema.parse(
      (await agent.get(`/api/brands/${brandId}/schedules`).expect(200)).body,
    );
    expect(listed?.lastRunId).toBe(run.id);
    await expectLedgerBalanced(me.workspace.id);

    await agent.post(`/api/schedules/${s.id}/run-now`).expect(400); // no Idempotency-Key
  });

  it('refuses with INSUFFICIENT_CREDITS when the balance is too low', async () => {
    const { agent, brandId, me } = await setup(3);
    await WorkspaceModel.updateOne({ _id: me.workspace.id }, { $set: { 'plan.tier': 'pro' } });
    const s = await create(
      agent,
      weekly(brandId, { platforms: ['chatgpt', 'perplexity', 'gemini', 'claude', 'google_aio'] }),
    );
    // 3 prompts × 5 platforms = 15 per run; 50 signup credits cover 3 runs.
    for (let i = 0; i < 3; i++) {
      await agent
        .post(`/api/schedules/${s.id}/run-now`)
        .set('Idempotency-Key', randomUUID())
        .expect(201);
    }
    const res = await agent
      .post(`/api/schedules/${s.id}/run-now`)
      .set('Idempotency-Key', randomUUID())
      .expect(402);
    expect(codeOf(res.body)).toBe('INSUFFICIENT_CREDITS');
    await expectLedgerBalanced(me.workspace.id);
  });
});
