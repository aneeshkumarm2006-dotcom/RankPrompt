import { z } from 'zod';
import { planStatusSchema, planTierSchema, platformSchema } from '../enums';
import { passwordSchema } from '../passwords';
import { isoDateSchema, textSchema } from './common';

/** Emails are compared and stored lowercase. */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: 'Enter a valid email address' }).max(254));

/** `?ref=` referral codes: 8 characters, case-insensitive. */
export const referralCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .pipe(z.string().regex(/^[A-Z0-9]{8}$/, 'not a referral code'));

/** Opaque one-time tokens from emailed links (base64url). */
const emailTokenSchema = z.string().regex(/^[\w-]{20,128}$/, 'This link is not valid');

export const registerBodySchema = z.object({
  name: textSchema(1, 100),
  email: emailSchema,
  password: passwordSchema,
  // An unknown or malformed code never blocks signup; it is just ignored.
  ref: z.string().max(64).optional(),
});
export type RegisterBody = z.infer<typeof registerBodySchema>;

export const loginBodySchema = z.object({
  email: emailSchema,
  // No policy check here: login must work for any stored password, and errors stay generic.
  password: z.string().min(1).max(1024),
});
export type LoginBody = z.infer<typeof loginBodySchema>;

export const googleBodySchema = z.object({
  credential: z.string().min(1).max(8192),
  ref: z.string().max(64).optional(),
});
export type GoogleBody = z.infer<typeof googleBodySchema>;

export const verifyEmailBodySchema = z.object({ token: emailTokenSchema });
export const forgotPasswordBodySchema = z.object({ email: emailSchema });
export const resetPasswordBodySchema = z.object({
  token: emailTokenSchema,
  password: passwordSchema,
});
export const changePasswordBodySchema = z.object({
  currentPassword: z.string().min(1).max(1024),
  newPassword: passwordSchema,
});

/**
 * Opt-outs for non-essential email (10 § Email): scheduled-run summaries and low-credit warnings.
 * Auth, billing and schedule-status emails (skipped, paused) always send.
 */
export const emailPrefsSchema = z.object({
  runCompleted: z.boolean(),
  lowCredits: z.boolean(),
});
export type EmailPrefs = z.infer<typeof emailPrefsSchema>;

export const patchMeBodySchema = z
  .object({
    emailPrefs: emailPrefsSchema.partial().optional(),
    name: textSchema(1, 100).optional(),
    avatarUrl: z
      .url({ protocol: /^https$/ })
      .max(2048)
      .nullable()
      .optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: 'Nothing to update' });
export type PatchMeBody = z.infer<typeof patchMeBodySchema>;

export const AUTH_METHODS = ['password', 'google'] as const;
export const authMethodSchema = z.enum(AUTH_METHODS);

export const workspacePlanSchema = z.object({
  tier: planTierSchema,
  status: planStatusSchema,
  currentPeriodEnd: isoDateSchema.nullable(),
  cancelAtPeriodEnd: z.boolean(),
  pendingTier: planTierSchema.nullable(),
});
export type WorkspacePlan = z.infer<typeof workspacePlanSchema>;

/** `GET /me`, and the body of every sign-in response (08). Never contains a token. */
export const meSchema = z.object({
  user: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    emailVerified: z.boolean(),
    avatarUrl: z.string().nullable(),
    authMethods: z.array(authMethodSchema),
    emailPrefs: emailPrefsSchema,
  }),
  workspace: z.object({
    id: z.string(),
    name: z.string(),
    plan: workspacePlanSchema,
    credits: z.object({ plan: z.number(), purchased: z.number(), total: z.number() }),
    limits: z.object({
      brands: z.number(),
      brandsUsed: z.number(),
      maxPromptsPerRun: z.number(),
      platforms: z.array(platformSchema),
    }),
    referralCode: z.string(),
  }),
});
export type Me = z.infer<typeof meSchema>;
