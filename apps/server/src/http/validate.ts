import type { Request, RequestHandler, Response } from 'express';
import { z } from 'zod';

interface Schemas<P extends z.ZodType, Q extends z.ZodType, B extends z.ZodType> {
  params?: P;
  query?: Q;
  body?: B;
}

export interface Input<P, Q, B> {
  params: P;
  query: Q;
  body: B;
}

const empty = z.object({});

/**
 * Wraps a route handler with zod validation of params, query and body (07 § Input handling).
 * Unknown keys are stripped and a failure becomes a 400 `VALIDATION_FAILED` with issue paths, so
 * the handler only ever sees typed, validated input. Missing schemas validate to `{}`.
 */
export function validate<
  P extends z.ZodType = typeof empty,
  Q extends z.ZodType = typeof empty,
  B extends z.ZodType = typeof empty,
>(
  schemas: Schemas<P, Q, B>,
  handler: (
    input: Input<z.output<P>, z.output<Q>, z.output<B>>,
    req: Request,
    res: Response,
  ) => Promise<void> | void,
): RequestHandler {
  return async (req, res) => {
    const input = {
      params: (schemas.params ?? empty).parse(req.params) as z.output<P>,
      query: (schemas.query ?? empty).parse(req.query) as z.output<Q>,
      body: (schemas.body ?? empty).parse(req.body ?? {}) as z.output<B>,
    };
    await handler(input, req, res);
  };
}
