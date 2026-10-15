import {
  errorEnvelopeSchema,
  referralsResponseSchema,
  submitSurveyResponseSchema,
  surveyStatusSchema,
  type SurveyAnswers,
} from '@pv/shared';
import { Types } from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withTransaction } from '../src/db/transaction';
import { ReferralModel } from '../src/modules/referrals/model';
import { referralsRepo } from '../src/modules/referrals/repo';
import { settleReferral } from '../src/modules/referrals/service';
import { ledgerMatchesBalance } from '../src/modules/credits/service';
import { workspacesRepo } from '../src/modules/workspaces/repo';
import { PASSWORD, client, connectTestDb, dropTestDb, makeTestApp, signUp } from './helpers';

/** TODO 6.4: the referral credit on email verification, and the survey grant (F-04, F-31). */

const { app, mailer, google } = makeTestApp();

beforeAll(() => connectTestDb('referrals_survey_test'));
afterAll(() => dropTestDb());

const balance = async (workspaceId: string) =>
  (await workspacesRepo.findById(workspaceId))?.credits;
const reconciled = async (workspaceId: string) =>
  expect((await ledgerMatchesBalance(new Types.ObjectId(workspaceId))).ok).toBe(true);

async function verify(email: string) {
  const token = await mailer.tokenFor(email, 'verify_email');
  await client(app).post('/api/auth/verify-email').send({ token }).expect(204);
}

describe('referral credit (6.4)', () => {
  it('credits the referrer +10 when the referred user verifies, once', async () => {
    const referrer = await signUp(app);
    const referred = await signUp(app, { ref: referrer.me.workspace.referralCode });

    let info = referralsResponseSchema.parse((await referrer.agent.get('/api/referrals')).body);
    expect(info).toMatchObject({ referredCount: 1, creditedCount: 0, creditsEarned: 0 });
    expect((await balance(referrer.me.workspace.id))?.purchased).toBe(50);

    await verify(referred.email);
    info = referralsResponseSchema.parse((await referrer.agent.get('/api/referrals')).body);
    expect(info).toMatchObject({ referredCount: 1, creditedCount: 1, creditsEarned: 10 });
    expect((await balance(referrer.me.workspace.id))?.purchased).toBe(60);
    // The referred user gets nothing extra.
    expect((await balance(referred.me.workspace.id))?.purchased).toBe(50);

    // A second verification path (password reset also proves the email) credits nothing more.
    await client(app).post('/api/auth/forgot-password').send({ email: referred.email }).expect(204);
    const reset = await mailer.tokenFor(referred.email, 'reset_password');
    await client(app)
      .post('/api/auth/reset-password')
      .send({ token: reset, password: `${PASSWORD}!` })
      .expect(204);
    expect((await balance(referrer.me.workspace.id))?.purchased).toBe(60);
    await reconciled(referrer.me.workspace.id);
  });

  it('a referred user who never verifies earns the referrer nothing', async () => {
    const referrer = await signUp(app);
    await signUp(app, { ref: referrer.me.workspace.referralCode });
    expect((await balance(referrer.me.workspace.id))?.purchased).toBe(50);
  });

  it('Google sign-up arrives verified, so the referral is credited at once', async () => {
    const referrer = await signUp(app);
    const credential = google.add(`g-${Date.now()}`, {
      googleId: `gid-${Date.now()}`,
      email: `google-${Date.now()}@example.com`,
      emailVerified: true,
      name: 'Google User',
      picture: null,
    });
    await client(app)
      .post('/api/auth/google')
      .send({ credential, ref: referrer.me.workspace.referralCode })
      .expect(200);
    expect((await balance(referrer.me.workspace.id))?.purchased).toBe(60);
    const info = referralsResponseSchema.parse((await referrer.agent.get('/api/referrals')).body);
    expect(info.creditedCount).toBe(1);
    await reconciled(referrer.me.workspace.id);
  });

  it('a self-referral (the user is in the referrer workspace) is rejected, not credited', async () => {
    const owner = await signUp(app);
    const workspaceId = new Types.ObjectId(owner.me.workspace.id);
    const userId = new Types.ObjectId();
    await withTransaction((session) =>
      referralsRepo.createPending(session, {
        referrerWorkspaceId: workspaceId,
        referredUserId: userId,
      }),
    );
    const outcome = await withTransaction((session) =>
      settleReferral(session, { userId, workspaceIds: [workspaceId] }),
    );
    expect(outcome).toBe('rejected');
    expect(await ReferralModel.findOne({ referredUserId: userId }).lean()).toMatchObject({
      status: 'rejected',
    });
    expect((await balance(owner.me.workspace.id))?.purchased).toBe(50);
    // Settling again finds nothing pending.
    expect(
      await withTransaction((session) =>
        settleReferral(session, { userId, workspaceIds: [workspaceId] }),
      ),
    ).toBeNull();
  });
});

const ANSWERS: SurveyAnswers = {
  usage: 'To research competitors',
  reportingFeature: 'Exportable PDF reports',
  aiFeatures: ['AI tips to improve visibility', 'Prompt volume estimates'],
  blocker: "Nothing — it's working well",
  recommend: 9,
  wishlist: '',
};

describe('survey (6.4, F-31)', () => {
  it('grants 50 purchased credits with the answers, once per user', async () => {
    const { agent, me } = await signUp(app);
    expect(surveyStatusSchema.parse((await agent.get('/api/survey')).body)).toEqual({
      completed: false,
      completedAt: null,
    });

    const res = await agent.post('/api/survey').send({ answers: ANSWERS }).expect(201);
    expect(submitSurveyResponseSchema.parse(res.body)).toEqual({ creditsAwarded: 50 });
    expect((await balance(me.workspace.id))?.purchased).toBe(100);
    const status = surveyStatusSchema.parse((await agent.get('/api/survey')).body);
    expect(status.completed).toBe(true);
    expect(status.completedAt).not.toBeNull();

    const again = await agent.post('/api/survey').send({ answers: ANSWERS }).expect(409);
    expect(errorEnvelopeSchema.parse(again.body).error.code).toBe('CONFLICT');
    expect((await balance(me.workspace.id))?.purchased).toBe(100);
    await reconciled(me.workspace.id);
  });

  it('two submissions at once grant once', async () => {
    const { agent, me } = await signUp(app);
    const replies = await Promise.all([
      agent.post('/api/survey').send({ answers: ANSWERS }),
      agent.post('/api/survey').send({ answers: ANSWERS }),
    ]);
    expect(replies.map((r) => r.status).sort()).toEqual([201, 409]);
    expect((await balance(me.workspace.id))?.purchased).toBe(100);
    await reconciled(me.workspace.id);
  });

  it('validates the answers with the shared schema', async () => {
    const { agent, me } = await signUp(app);
    await agent
      .post('/api/survey')
      .send({ answers: { ...ANSWERS, recommend: 11 } })
      .expect(400);
    await agent
      .post('/api/survey')
      .send({ answers: { ...ANSWERS, aiFeatures: ['a', 'b', 'c', 'd'] } })
      .expect(400);
    expect((await balance(me.workspace.id))?.purchased).toBe(50);
  });
});
