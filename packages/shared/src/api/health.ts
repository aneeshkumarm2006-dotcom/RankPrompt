import { z } from 'zod';

/** `GET /api/health`: liveness. */
export const healthResponseSchema = z.object({
  ok: z.literal(true),
  version: z.string(),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;

/** `GET /api/ready`: readiness. 200 when ready, 503 otherwise, with the same body shape. */
export const readyResponseSchema = z.object({
  ok: z.boolean(),
  version: z.string(),
  checks: z.object({
    db: z.object({ ok: z.boolean(), latencyMs: z.number().nullable() }),
    worker: z.object({
      enabled: z.boolean(),
      /** Milliseconds since the worker's last heartbeat; null until the worker exists (Stage 4). */
      heartbeatAgeMs: z.number().nullable(),
    }),
    shuttingDown: z.boolean(),
  }),
});
export type ReadyResponse = z.infer<typeof readyResponseSchema>;
