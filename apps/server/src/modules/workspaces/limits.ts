import { getPlan, type Plan, type PlanTier, type Platform } from '@pv/shared';
import { AppError } from '../../http/errors';

/**
 * Plan limits, enforced on the server (F-36, F-37). The numbers live in `shared/plans.ts`; Q-001
 * and Q-003 may change them without touching these checks. `POST /runs` (Stage 4) reuses them.
 */
export const planFor = (tier: PlanTier): Plan => getPlan(tier);

export function assertBrandSlot(plan: Plan, brandsUsed: number): void {
  if (brandsUsed >= plan.limits.brands) {
    throw new AppError(
      'BRAND_LIMIT_REACHED',
      `Your ${plan.name} plan allows ${plan.limits.brands} brand${plan.limits.brands === 1 ? '' : 's'}. Upgrade or archive a brand to add another.`,
      { limit: plan.limits.brands, used: brandsUsed },
    );
  }
}

export function assertPlatformsAllowed(plan: Plan, platforms: readonly Platform[]): void {
  const notAllowed = platforms.filter((p) => !plan.limits.platforms.includes(p));
  if (notAllowed.length) {
    throw new AppError(
      'PLATFORM_NOT_IN_PLAN',
      `Your ${plan.name} plan doesn't include: ${notAllowed.join(', ')}`,
      { notAllowed, allowed: [...plan.limits.platforms] },
    );
  }
}

export function assertPromptCount(plan: Plan, count: number): void {
  if (count > plan.limits.maxPromptsPerRun) {
    throw new AppError(
      'TOO_MANY_PROMPTS',
      `Your ${plan.name} plan allows up to ${plan.limits.maxPromptsPerRun} prompts per run`,
      { max: plan.limits.maxPromptsPerRun },
    );
  }
}
