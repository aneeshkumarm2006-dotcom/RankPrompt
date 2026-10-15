import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { LedgerModel } from '../src/modules/credits/model';
import { ledgerRepo } from '../src/modules/credits/repo';
import { MembershipModel } from '../src/modules/memberships/model';
import { ReferralModel } from '../src/modules/referrals/model';
import { referralsRepo } from '../src/modules/referrals/repo';
import { UserModel } from '../src/modules/users/model';
import { WorkspaceModel } from '../src/modules/workspaces/model';
import { membershipsRepo } from '../src/modules/memberships/repo';
import {
  PASSWORD,
  client,
  connectTestDb,
  dropTestDb,
  makeTestApp,
  signUp,
  uniqueEmail,
} from './helpers';

const { app } = makeTestApp();

beforeAll(() => connectTestDb('signup_test'));
afterAll(() => dropTestDb());
afterEach(() => {
  vi.restoreAllMocks();
});

const all = { crossWorkspace: true };

async function counts() {
  return {
    users: await UserModel.countDocuments({}),
    workspaces: await WorkspaceModel.countDocuments({}),
    memberships: await MembershipModel.countDocuments({}).setOptions(all),
    ledger: await LedgerModel.countDocuments({}).setOptions(all),
    referrals: await ReferralModel.countDocuments({}),
  };
}

describe('signup transaction (3.4)', () => {
  it('creates user, workspace, owner membership, the 50-credit ledger row and the balance together', async () => {
    const before = await counts();
    const { me } = await signUp(app);
    expect(await counts()).toEqual({
      ...before,
      users: before.users + 1,
      workspaces: before.workspaces + 1,
      memberships: before.memberships + 1,
      ledger: before.ledger + 1,
    });

    const ledger = await LedgerModel.findOne({ workspaceId: me.workspace.id }).lean();
    expect(ledger).toMatchObject({
      delta: 50,
      bucket: 'purchased',
      reason: 'signup_bonus',
      refType: 'user',
      refId: me.user.id,
      balanceAfter: { plan: 0, purchased: 50 },
    });
    const ws = await WorkspaceModel.findById(me.workspace.id).lean();
    expect(ws?.credits).toEqual({ plan: 0, purchased: 50 });
    expect(await membershipsRepo.roleOf(me.workspace.id, me.user.id)).toBe('owner');
  });

  it.each([
    ['the ledger insert', () => vi.spyOn(ledgerRepo, 'insert')],
    ['the referral insert', () => vi.spyOn(referralsRepo, 'createPending')],
  ])('leaves nothing behind when %s fails', async (_what, spy) => {
    const { me: referrer } = await signUp(app);
    spy().mockRejectedValueOnce(new Error('injected failure'));
    const before = await counts();
    const email = uniqueEmail('atomic');

    const res = await client(app)
      .post('/api/auth/register')
      .send({ name: 'Half', email, password: PASSWORD, ref: referrer.workspace.referralCode })
      .expect(500);

    expect(res.body).toMatchObject({ error: { code: 'INTERNAL' } });
    expect(await counts()).toEqual(before);
    expect(await UserModel.exists({ email })).toBeNull();
    // And the same email can sign up properly afterwards.
    await signUp(app, { email });
  });

  it('a race on one email creates exactly one account', async () => {
    const email = uniqueEmail('race');
    const results = await Promise.all(
      [1, 2, 3].map(() =>
        client(app).post('/api/auth/register').send({ name: 'Racer', email, password: PASSWORD }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409]);
    expect(await UserModel.countDocuments({ email })).toBe(1);
    expect(await WorkspaceModel.countDocuments({ name: "Racer's workspace" })).toBe(1);
  });
});

describe('referrals at signup (F-04)', () => {
  it('stores a pending referral for a valid ?ref= code, case-insensitively', async () => {
    const { me: referrer } = await signUp(app);
    const { me } = await signUp(app, { ref: referrer.workspace.referralCode.toLowerCase() });
    const referral = await ReferralModel.findOne({ referredUserId: me.user.id }).lean();
    expect(referral?.status).toBe('pending');
    expect(referral?.referrerWorkspaceId.toHexString()).toBe(referrer.workspace.id);
    // No credit until the referred user verifies their email (Stage 6.4).
    const ws = await WorkspaceModel.findById(referrer.workspace.id).lean();
    expect(ws?.credits.purchased).toBe(50);
  });

  it('ignores unknown or malformed codes', async () => {
    const before = await ReferralModel.countDocuments({});
    await signUp(app, { ref: 'ZZZZZZZZ' });
    await signUp(app, { ref: 'not a code!' });
    expect(await ReferralModel.countDocuments({})).toBe(before);
  });
});
