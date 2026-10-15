import { z } from 'zod';
import { COUNTRIES } from '../countries';
import {
  PLAN_TIERS,
  PLATFORM_LABELS,
  PLATFORMS,
  planTierSchema,
  platformSchema,
  scheduleFrequencySchema,
} from '../enums';
import { LANGUAGES } from '../languages';
import { CREDIT_GRANTS, PLANS, TOPUPS, TOPUP_PACKS, topupPackSchema } from '../plans';

/** `GET /plans`: what the landing page, pricing and credit modals show (06). */
export const plansResponseSchema = z.object({
  plans: z.array(
    z.object({
      tier: planTierSchema,
      name: z.string(),
      priceCentsMonthly: z.number(),
      monthlyCredits: z.number(),
      limits: z.object({
        brands: z.number(),
        maxPromptsPerRun: z.number(),
        platforms: z.array(platformSchema),
        scheduleFrequencies: z.array(scheduleFrequencySchema),
      }),
    }),
  ),
  topups: z.array(z.object({ pack: topupPackSchema, credits: z.number(), priceCents: z.number() })),
  grants: z.object({ signupBonus: z.number(), referral: z.number(), survey: z.number() }),
});
export type PlansResponse = z.infer<typeof plansResponseSchema>;

export const buildPlansResponse = (): PlansResponse => ({
  plans: PLAN_TIERS.map((tier) => {
    const plan = PLANS[tier];
    return {
      ...plan,
      limits: {
        ...plan.limits,
        platforms: [...plan.limits.platforms],
        scheduleFrequencies: [...plan.limits.scheduleFrequencies],
      },
    };
  }),
  topups: TOPUP_PACKS.map((pack) => ({ ...TOPUPS[pack] })),
  grants: { ...CREDIT_GRANTS },
});

/** `GET /meta`: option lists for forms. */
export const metaResponseSchema = z.object({
  countries: z.array(z.object({ code: z.string(), name: z.string() })),
  languages: z.array(z.object({ code: z.string(), name: z.string() })),
  platforms: z.array(z.object({ id: platformSchema, label: z.string() })),
});
export type MetaResponse = z.infer<typeof metaResponseSchema>;

export const buildMetaResponse = (): MetaResponse => ({
  countries: COUNTRIES.map((c) => ({ ...c })),
  languages: LANGUAGES.map((l) => ({ ...l })),
  platforms: PLATFORMS.map((id) => ({ id, label: PLATFORM_LABELS[id] })),
});
