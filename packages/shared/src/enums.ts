import { z } from 'zod';

/** The only platform spellings (D-003). v1's google_ai_overview(s) / googleAiOverviews are gone. */
export const PLATFORMS = ['chatgpt', 'perplexity', 'gemini', 'claude', 'google_aio'] as const;
export const platformSchema = z.enum(PLATFORMS);
export type Platform = z.infer<typeof platformSchema>;

export const PLATFORM_LABELS: Record<Platform, string> = {
  chatgpt: 'ChatGPT',
  perplexity: 'Perplexity',
  gemini: 'Gemini',
  claude: 'Claude',
  google_aio: 'Google AI Overviews',
};

export const RUN_STATUSES = [
  'queued',
  'running',
  'finalizing',
  'completed',
  'partial',
  'failed',
  'canceled',
] as const;
export const runStatusSchema = z.enum(RUN_STATUSES);
export type RunStatus = z.infer<typeof runStatusSchema>;

/** A run in one of these statuses never changes again. */
export const FINAL_RUN_STATUSES = [
  'completed',
  'partial',
  'failed',
  'canceled',
] as const satisfies readonly RunStatus[];
export const isFinalRunStatus = (status: RunStatus): boolean =>
  (FINAL_RUN_STATUSES as readonly RunStatus[]).includes(status);

export const CHECK_STATUSES = [
  'pending',
  'running',
  'ok',
  'no_answer',
  'failed',
  'canceled',
] as const;
export const checkStatusSchema = z.enum(CHECK_STATUSES);
export type CheckStatus = z.infer<typeof checkStatusSchema>;

export const RUN_TRIGGERS = ['manual', 'scheduled'] as const;
export const runTriggerSchema = z.enum(RUN_TRIGGERS);
export type RunTrigger = z.infer<typeof runTriggerSchema>;

export const SCOPES = ['national', 'local'] as const;
export const scopeSchema = z.enum(SCOPES);
export type Scope = z.infer<typeof scopeSchema>;

export const PLAN_TIERS = ['free', 'starter', 'pro', 'agency'] as const;
export const planTierSchema = z.enum(PLAN_TIERS);
export type PlanTier = z.infer<typeof planTierSchema>;

export const PLAN_STATUSES = ['active', 'past_due', 'canceled', 'none'] as const;
export const planStatusSchema = z.enum(PLAN_STATUSES);
export type PlanStatus = z.infer<typeof planStatusSchema>;

export const CREDIT_BUCKETS = ['plan', 'purchased'] as const;
export const creditBucketSchema = z.enum(CREDIT_BUCKETS);
export type CreditBucket = z.infer<typeof creditBucketSchema>;

export const MEMBERSHIP_ROLES = ['owner', 'admin', 'member'] as const;
export const membershipRoleSchema = z.enum(MEMBERSHIP_ROLES);
export type MembershipRole = z.infer<typeof membershipRoleSchema>;

export const SCHEDULE_FREQUENCIES = ['daily', 'weekly', 'monthly'] as const;
export const scheduleFrequencySchema = z.enum(SCHEDULE_FREQUENCIES);
export type ScheduleFrequency = z.infer<typeof scheduleFrequencySchema>;
