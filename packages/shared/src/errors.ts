import { z } from 'zod';

/** API error codes (08 § Error codes). The HTTP status each one maps to is fixed here. */
export const ERROR_STATUS = {
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  TOKEN_EXPIRED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INVALID_CREDENTIALS: 401,
  EMAIL_NOT_VERIFIED: 403,
  BRAND_LIMIT_REACHED: 409,
  BRAND_EXISTS: 409,
  INSUFFICIENT_CREDITS: 402,
  PLATFORM_NOT_IN_PLAN: 403,
  TOO_MANY_PROMPTS: 422,
  SUBSCRIPTION_EXISTS: 409,
  RUN_NOT_FINAL: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
  /** An AI provider or other upstream service failed or isn't configured; safe to retry later. */
  UPSTREAM_UNAVAILABLE: 503,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;
export const ERROR_CODES = Object.keys(ERROR_STATUS) as [ErrorCode, ...ErrorCode[]];
export const errorCodeSchema = z.enum(ERROR_CODES);

/** Every non-2xx API response body: `{ error: { code, message, details?, requestId? } }` (07). */
export const errorEnvelopeSchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string(),
    details: z.unknown().optional(),
    requestId: z.string().optional(),
  }),
});
export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;
