import { z } from 'zod';

/** A Mongo ObjectId as the API exposes it: 24 lowercase hex characters. */
export const objectIdSchema = z
  .string()
  .regex(/^[a-f0-9]{24}$/i, 'must be an id')
  .transform((s) => s.toLowerCase());

/** `/:id` route params. */
export const idParamsSchema = z.object({ id: objectIdSchema });
export type IdParams = z.infer<typeof idParamsSchema>;

/** Timestamps travel as ISO 8601 strings. */
export const isoDateSchema = z.iso.datetime({ offset: true });

/** `?flag=true|false|1|0` query params. */
export const queryBoolSchema = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

/** Trimmed, whitespace-collapsed text with length limits. */
export const textSchema = (min: number, max: number) =>
  z
    .string()
    .transform((s) => s.trim().replace(/\s+/g, ' '))
    .pipe(z.string().min(min).max(max));

/** Cursor-paginated list: `{ items, nextCursor }` (08). */
export const pageSchema = <T extends z.ZodType>(item: T) =>
  z.object({ items: z.array(item), nextCursor: z.string().nullable() });
