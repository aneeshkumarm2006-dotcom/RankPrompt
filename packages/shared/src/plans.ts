import { z } from 'zod';
import {
  PLATFORMS,
  SCHEDULE_FREQUENCIES,
  type Platform,
  type PlanTier,
  type ScheduleFrequency,
} from './enums';

/**
 * Plan matrix skeleton (06 § Plans). Starting values are copied from v1; Q-003 (prices, credits,
 * brand limits) and Q-001 (platforms / Claude weights) decide the final numbers.
 * Display prices are cosmetic: Stripe price ids (server env) decide what is charged.
 */
export interface PlanLimits {
  brands: number;
  maxPromptsPerRun: number;
  platforms: readonly Platform[];
  scheduleFrequencies: readonly ScheduleFrequency[];
}

export interface Plan {
  tier: PlanTier;
  name: string;
  /** Display price in whole US cents per month. */
  priceCentsMonthly: number;
  /** Plan-bucket credits granted each billing cycle (reset, never rolled over). */
  monthlyCredits: number;
  limits: PlanLimits;
}

export const PLANS: Readonly<Record<PlanTier, Plan>> = {
  free: {
    tier: 'free',
    name: 'Free',
    priceCentsMonthly: 0,
    monthlyCredits: 0,
    limits: {
      brands: 1,
      maxPromptsPerRun: 25,
      platforms: PLATFORMS,
      scheduleFrequencies: ['weekly', 'monthly'],
    },
  },
  starter: {
    tier: 'starter',
    name: 'Starter',
    priceCentsMonthly: 9900,
    monthlyCredits: 150,
    limits: {
      brands: 1,
      maxPromptsPerRun: 50,
      platforms: PLATFORMS,
      scheduleFrequencies: SCHEDULE_FREQUENCIES,
    },
  },
  pro: {
    tier: 'pro',
    name: 'Pro',
    priceCentsMonthly: 14900,
    monthlyCredits: 500,
    limits: {
      brands: 3,
      maxPromptsPerRun: 150,
      platforms: PLATFORMS,
      scheduleFrequencies: SCHEDULE_FREQUENCIES,
    },
  },
  agency: {
    tier: 'agency',
    name: 'Agency',
    priceCentsMonthly: 24900,
    monthlyCredits: 1000,
    limits: {
      brands: 20, // Q-003: the v1 UI said 5
      maxPromptsPerRun: 150,
      platforms: PLATFORMS,
      scheduleFrequencies: SCHEDULE_FREQUENCIES,
    },
  },
};

export const getPlan = (tier: PlanTier): Plan => PLANS[tier];

export const TOPUP_PACKS = ['topup_50', 'topup_100', 'topup_200'] as const;
export const topupPackSchema = z.enum(TOPUP_PACKS);
export type TopupPack = z.infer<typeof topupPackSchema>;

export interface Topup {
  pack: TopupPack;
  credits: number;
  /** Display price in whole US cents. */
  priceCents: number;
}

export const TOPUPS: Readonly<Record<TopupPack, Topup>> = {
  topup_50: { pack: 'topup_50', credits: 50, priceCents: 2000 },
  topup_100: { pack: 'topup_100', credits: 100, priceCents: 4000 },
  topup_200: { pack: 'topup_200', credits: 200, priceCents: 8000 },
};

/** Purchased-bucket grants that are not tied to a plan (06 § Grants and spends). */
export const CREDIT_GRANTS = {
  signupBonus: 50,
  referral: 10,
  survey: 50,
} as const;
