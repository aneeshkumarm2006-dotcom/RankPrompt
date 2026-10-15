import { buildPlansResponse, type WorkspacePlan } from '@pv/shared';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../lib/api/client';
import {
  billingErrorMessage,
  hasSubscription,
  planFeatures,
  renewalText,
  returnNotice,
} from './billingText';

const sub = (patch: Partial<WorkspacePlan> = {}): WorkspacePlan => ({
  tier: 'pro',
  status: 'active',
  currentPeriodEnd: '2026-11-01T12:00:00.000Z',
  cancelAtPeriodEnd: false,
  pendingTier: null,
  ...patch,
});

describe('returnNotice', () => {
  it('maps Stripe return params', () => {
    expect(returnNotice(new URLSearchParams('checkout=success'))?.kind).toBe('success');
    expect(returnNotice(new URLSearchParams('topup=success'))?.kind).toBe('success');
    expect(returnNotice(new URLSearchParams('checkout=cancel'))?.kind).toBe('info');
    expect(returnNotice(new URLSearchParams('foo=bar'))).toBeNull();
  });
});

describe('subscription text', () => {
  it('describes renewal, cancellation and pending changes', () => {
    expect(renewalText(sub())).toMatch(/^Renews on /);
    expect(renewalText(sub({ cancelAtPeriodEnd: true }))).toMatch(/^Ends on /);
    expect(renewalText(sub({ pendingTier: 'starter' }))).toMatch(/^Switches to Starter on /);
    expect(renewalText(sub({ tier: 'free', currentPeriodEnd: null }))).toBeNull();
  });

  it('knows when there is a subscription to manage', () => {
    expect(hasSubscription(sub())).toBe(true);
    expect(hasSubscription(sub({ status: 'past_due' }))).toBe(true);
    expect(hasSubscription(sub({ status: 'canceled' }))).toBe(false);
    expect(hasSubscription(sub({ tier: 'free', status: 'none' }))).toBe(false);
  });

  it('builds plan features from /plans data', () => {
    const pro = buildPlansResponse().plans.find((p) => p.tier === 'pro')!;
    expect(planFeatures(pro)[0]).toBe(`${pro.monthlyCredits} credits every month`);
  });

  it('turns billing errors into friendly text', () => {
    expect(billingErrorMessage(new ApiError('NOT_FOUND', 'x', 404))).toMatch(
      /once billing is connected/,
    );
    expect(billingErrorMessage(new ApiError('SUBSCRIPTION_EXISTS', 'x', 409))).toMatch(
      /Manage subscription/,
    );
    expect(billingErrorMessage(new ApiError('EMAIL_NOT_VERIFIED', 'x', 403))).toMatch(
      /verify your email/,
    );
    expect(billingErrorMessage(new ApiError('UPSTREAM_UNAVAILABLE', 'x', 503))).toMatch(
      /unavailable right now/,
    );
  });
});
