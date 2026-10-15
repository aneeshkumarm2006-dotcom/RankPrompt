import type { RequestHandler } from 'express';
import { AppError } from '../../http/errors';
import { membershipsRepo } from '../memberships/repo';
import { sessionsRepo } from '../sessions/repo';
import type { SessionCache } from './sessionCache';
import { ACCESS_COOKIE, type AccessTokens } from './tokens';

/**
 * Turns the `pv_at` cookie into `req.ctx` (07 § Request context). The session must still be live
 * and the user still a member of the token's workspace (cached 60 s). Missing or bad token: 401
 * `UNAUTHENTICATED`; expired token: 401 `TOKEN_EXPIRED`, so the client refreshes and retries.
 */
export function requireAuth(access: AccessTokens, cache: SessionCache): RequestHandler {
  return async (req, _res, next) => {
    const token = (req.cookies as Record<string, unknown> | undefined)?.[ACCESS_COOKIE];
    if (typeof token !== 'string' || !token) {
      throw new AppError('UNAUTHENTICATED', 'Please sign in');
    }
    const claims = await access.verify(token);

    let role = cache.get(claims.sessionId);
    if (role === undefined) {
      const [live, memberRole] = await Promise.all([
        sessionsRepo.isLive(claims.sessionId),
        membershipsRepo.roleOf(claims.workspaceId, claims.userId),
      ]);
      role = live ? memberRole : null;
      cache.set(claims.sessionId, role);
    }
    if (role === null) throw new AppError('UNAUTHENTICATED', 'Please sign in');

    req.ctx = { ...claims, role };
    next();
  };
}
