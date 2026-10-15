import { PAID_TIERS, TOPUP_PACKS, type PaidTier, type TopupPack } from '@pv/shared';
import type { Env } from '../../config/env';

/**
 * Stripe price ids ↔ our tiers and packs (06 § Plans). The ids come from env (the existing v1
 * prices): Stripe decides what is charged, `shared/plans.ts` decides what it is worth in credits.
 */
export interface PriceBook {
  forTier(tier: PaidTier): string | undefined;
  forPack(pack: TopupPack): string | undefined;
  tierOf(priceId: string): PaidTier | null;
  packOf(priceId: string): TopupPack | null;
  /** Every configured subscription price (the portal's plan-switch list). */
  tierPrices(): { tier: PaidTier; priceId: string }[];
}

export type PriceEnv = Pick<
  Env,
  | 'STRIPE_PRICE_STARTER'
  | 'STRIPE_PRICE_PRO'
  | 'STRIPE_PRICE_AGENCY'
  | 'STRIPE_PRICE_TOPUP_50'
  | 'STRIPE_PRICE_TOPUP_100'
  | 'STRIPE_PRICE_TOPUP_200'
>;

export function priceBookFromEnv(env: PriceEnv): PriceBook {
  const tiers: Record<PaidTier, string | undefined> = {
    starter: env.STRIPE_PRICE_STARTER,
    pro: env.STRIPE_PRICE_PRO,
    agency: env.STRIPE_PRICE_AGENCY,
  };
  const packs: Record<TopupPack, string | undefined> = {
    topup_50: env.STRIPE_PRICE_TOPUP_50,
    topup_100: env.STRIPE_PRICE_TOPUP_100,
    topup_200: env.STRIPE_PRICE_TOPUP_200,
  };
  return {
    forTier: (tier) => tiers[tier],
    forPack: (pack) => packs[pack],
    tierOf: (priceId) => PAID_TIERS.find((t) => tiers[t] === priceId) ?? null,
    packOf: (priceId) => TOPUP_PACKS.find((p) => packs[p] === priceId) ?? null,
    tierPrices: () =>
      PAID_TIERS.flatMap((tier) => {
        const priceId = tiers[tier];
        return priceId ? [{ tier, priceId }] : [];
      }),
  };
}
