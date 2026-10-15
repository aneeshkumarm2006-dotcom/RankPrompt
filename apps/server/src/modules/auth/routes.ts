import {
  forgotPasswordBodySchema,
  googleBodySchema,
  loginBodySchema,
  registerBodySchema,
  resetPasswordBodySchema,
  verifyEmailBodySchema,
} from '@pv/shared';
import { Router, type Request, type RequestHandler, type Response } from 'express';
import {
  authIpLimiter,
  emailLimiter,
  userLimiter,
  type RateLimitConfig,
} from '../../http/middleware/rateLimits';
import { ctxOf } from '../../http/context';
import { validate } from '../../http/validate';
import { getMe } from '../me/service';
import { RefreshRaceError, type AuthService, type ClientInfo, type Issued } from './service';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  clearAuthCookies,
  setAuthCookies,
  type AccessTokens,
  type CookieConfig,
} from './tokens';

export interface AuthRouteDeps {
  auth: AuthService;
  access: AccessTokens;
  cookies: CookieConfig;
  limits: RateLimitConfig;
  requireAuth: RequestHandler;
}

const clientOf = (req: Request): ClientInfo => ({
  userAgent: req.get('user-agent') ?? '',
  ip: req.ip ?? '',
});

const cookie = (req: Request, name: string): string | undefined => {
  const value = (req.cookies as Record<string, unknown> | undefined)?.[name];
  return typeof value === 'string' && value ? value : undefined;
};

/** `/auth/*` (08 § Auth and me). Tokens only ever travel in httpOnly cookies (07). */
export function authRoutes(deps: AuthRouteDeps): Router {
  const router = Router();
  const ipLimit = authIpLimiter(deps.limits);

  const signedIn = async (res: Response, issued: Issued, status = 200) => {
    setAuthCookies(res, deps.cookies, issued);
    res.status(status).json(await getMe(issued));
  };

  router.post(
    '/auth/register',
    ipLimit,
    validate({ body: registerBodySchema }, async ({ body }, req, res) => {
      await signedIn(res, await deps.auth.register(body, clientOf(req)), 201);
    }),
  );

  router.post(
    '/auth/login',
    ipLimit,
    validate({ body: loginBodySchema }, async ({ body }, req, res) => {
      await signedIn(res, await deps.auth.login(body, clientOf(req)));
    }),
  );

  router.post(
    '/auth/google',
    ipLimit,
    validate({ body: googleBodySchema }, async ({ body }, req, res) => {
      await signedIn(res, await deps.auth.google(body, clientOf(req)));
    }),
  );

  router.post('/auth/refresh', async (req, res) => {
    try {
      const issued = await deps.auth.refresh(cookie(req, REFRESH_COOKIE), clientOf(req));
      setAuthCookies(res, deps.cookies, issued);
      res.status(204).end();
    } catch (err) {
      if (!(err instanceof RefreshRaceError)) clearAuthCookies(res, deps.cookies);
      throw err;
    }
  });

  router.post('/auth/logout', async (req, res) => {
    const accessToken = cookie(req, ACCESS_COOKIE);
    const sessionId = accessToken
      ? await deps.access.verify(accessToken).then(
          (c) => c.sessionId,
          () => undefined,
        )
      : undefined;
    await deps.auth.logout(cookie(req, REFRESH_COOKIE), sessionId);
    clearAuthCookies(res, deps.cookies);
    res.status(204).end();
  });

  router.post('/auth/logout-all', deps.requireAuth, async (req, res) => {
    await deps.auth.logoutAll(ctxOf(req));
    clearAuthCookies(res, deps.cookies);
    res.status(204).end();
  });

  router.post(
    '/auth/verify-email',
    validate({ body: verifyEmailBodySchema }, async ({ body }, _req, res) => {
      await deps.auth.verifyEmail(body.token);
      res.status(204).end();
    }),
  );

  router.post(
    '/auth/resend-verification',
    deps.requireAuth,
    userLimiter(deps.limits, 'resend-verification'),
    async (req, res) => {
      await deps.auth.resendVerification(ctxOf(req));
      res.status(204).end();
    },
  );

  router.post(
    '/auth/forgot-password',
    emailLimiter(deps.limits, 'forgot-password'),
    validate({ body: forgotPasswordBodySchema }, async ({ body }, _req, res) => {
      await deps.auth.forgotPassword(body.email);
      res.status(204).end();
    }),
  );

  router.post(
    '/auth/reset-password',
    validate({ body: resetPasswordBodySchema }, async ({ body }, _req, res) => {
      await deps.auth.resetPassword(body.token, body.password);
      res.status(204).end();
    }),
  );

  return router;
}
