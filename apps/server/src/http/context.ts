import type { MembershipRole } from '@pv/shared';
import type { Request } from 'express';
import { AppError } from './errors';

/**
 * Who is calling, set by `requireAuth` (07 § Request context). Every service and repo function
 * that touches owned data takes it as its first argument.
 */
export interface Ctx {
  userId: string;
  workspaceId: string;
  role: MembershipRole;
  sessionId: string;
}

declare global {
  // Express exposes its Request type for augmentation only through this global namespace.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      ctx?: Ctx;
    }
  }
}

/** The caller's context. Only valid behind `requireAuth`. */
export function ctxOf(req: Request): Ctx {
  if (!req.ctx) throw new AppError('UNAUTHENTICATED', 'Please sign in');
  return req.ctx;
}
