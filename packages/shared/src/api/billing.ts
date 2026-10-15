import { z } from 'zod';
import { creditBucketSchema } from '../enums';
import { topupPackSchema } from '../plans';
import { workspacePlanSchema } from './auth';
import { isoDateSchema, pageSchema } from './common';

/**
 * Billing and credits (08 § Billing and credits, 06). Defined in Stage 5 so the web pages could be
 * built first; the server implements them since Stage 6 (D-025).
 */

/** Paid tiers only: `free` is what a workspace falls back to, never something you buy. */
export const PAID_TIERS = ['starter', 'pro', 'agency'] as const;
export const paidTierSchema = z.enum(PAID_TIERS);
export type PaidTier = z.infer<typeof paidTierSchema>;

export const checkoutBodySchema = z.object({ tier: paidTierSchema });
export const topupBodySchema = z.object({ pack: topupPackSchema });

/** Checkout, top-up and portal all answer with the Stripe-hosted URL to send the browser to. */
export const redirectUrlSchema = z.object({ url: z.url() });
export type RedirectUrl = z.infer<typeof redirectUrlSchema>;

/** `GET /billing/subscription`. */
export const subscriptionSchema = workspacePlanSchema;
export type Subscription = z.infer<typeof subscriptionSchema>;

// ---- Credits ledger -------------------------------------------------------------------------

export const LEDGER_REASONS = [
  'signup_bonus',
  'referral',
  'survey',
  'topup',
  'plan_grant',
  'plan_reset',
  'run_reserve',
  'run_refund',
  'admin_adjust',
] as const;
export const ledgerReasonSchema = z.enum(LEDGER_REASONS);
export type LedgerReason = z.infer<typeof ledgerReasonSchema>;

export const LEDGER_REASON_LABELS: Record<LedgerReason, string> = {
  signup_bonus: 'Signup bonus',
  referral: 'Referral reward',
  survey: 'Survey reward',
  topup: 'Credit top-up',
  plan_grant: 'Plan credits',
  plan_reset: 'Plan credits reset',
  run_reserve: 'Run',
  run_refund: 'Run refund',
  admin_adjust: 'Adjustment',
};

export const ledgerEntrySchema = z.object({
  id: z.string(),
  delta: z.number(),
  bucket: creditBucketSchema,
  reason: ledgerReasonSchema,
  /** The run a `run_reserve` / `run_refund` row belongs to; null otherwise. */
  runId: z.string().nullable(),
  note: z.string(),
  balanceAfter: z.object({ plan: z.number(), purchased: z.number() }),
  createdAt: isoDateSchema,
});
export type LedgerEntry = z.infer<typeof ledgerEntrySchema>;
export const ledgerPageSchema = pageSchema(ledgerEntrySchema);
export type LedgerPage = z.infer<typeof ledgerPageSchema>;

// ---- Referrals and survey -------------------------------------------------------------------

/** `GET /referrals`: counts only, never the referred users' emails (06). */
export const referralsResponseSchema = z.object({
  code: z.string(),
  link: z.string(),
  referredCount: z.number(),
  creditedCount: z.number(),
  creditsEarned: z.number(),
});
export type ReferralsResponse = z.infer<typeof referralsResponseSchema>;

export const surveyStatusSchema = z.object({
  completed: z.boolean(),
  completedAt: isoDateSchema.nullable(),
});
export type SurveyStatus = z.infer<typeof surveyStatusSchema>;

/** The six v1 survey questions (SurveyModal.jsx), kept as they were. */
export const SURVEY_QUESTIONS = [
  {
    key: 'usage',
    question: 'How are you currently using PromptVerse?',
    type: 'single',
    options: [
      'To see if my brand shows up in AI tools (ChatGPT, Perplexity, etc.)',
      'To research competitors',
      'To improve SEO visibility',
      "I'm just testing it out",
      'Other',
    ],
  },
  {
    key: 'reportingFeature',
    question: 'Which reporting feature would be most valuable to you?',
    type: 'single',
    options: [
      'Exportable PDF reports',
      'White-label reports (your branding)',
      'Track visibility over time',
      'Email alerts when visibility changes',
      'None of these',
    ],
  },
  {
    key: 'aiFeatures',
    question: 'Which AI features would be most helpful to you?',
    type: 'multiple',
    max: 3,
    options: [
      'AI tips to improve visibility',
      'Keyword clusters based on prompt intent',
      'Prompt volume estimates',
      'Traffic breakdown from ChatGPT / Perplexity',
      'Content creation / optimization tools',
      'Add more AI sources (like Gemini, Claude, etc.)',
      'None of these',
    ],
  },
  {
    key: 'blocker',
    question: "What's the biggest thing holding you back from getting more value?",
    type: 'single',
    options: [
      "I'm not sure what to do with the results",
      'I wish it analyzed more prompts per check',
      'I want clearer action steps after each report',
      'The interface is too complex',
      "Nothing — it's working well",
      'Other',
    ],
  },
  {
    key: 'recommend',
    question: 'How likely are you to recommend PromptVerse to a friend or colleague?',
    type: 'scale',
    min: 0,
    max: 10,
  },
  {
    key: 'wishlist',
    question: 'Anything else we should build?',
    type: 'text',
  },
] as const;

const answer = z.string().trim().min(1).max(200);

export const surveyAnswersSchema = z.object({
  usage: answer,
  reportingFeature: answer,
  aiFeatures: z.array(answer).min(1).max(3),
  blocker: answer,
  recommend: z.number().int().min(0).max(10),
  wishlist: z.string().trim().max(2000).default(''),
});
export type SurveyAnswers = z.output<typeof surveyAnswersSchema>;

export const submitSurveyBodySchema = z.object({ answers: surveyAnswersSchema });
export const submitSurveyResponseSchema = z.object({ creditsAwarded: z.number() });
