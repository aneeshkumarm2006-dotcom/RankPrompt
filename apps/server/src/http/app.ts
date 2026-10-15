import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import type { Env } from '../config/env';
import type { Logger } from '../config/logger';
import { ErrorSpikeAlarm } from './middleware/errorSpike';
import type { ErrorReporter } from '../config/sentry';
import { buildIntegrations, type Integrations } from '../integrations';
import type { Readiness } from '../lifecycle/readiness';
import { requireAuth } from '../modules/auth/middleware';
import { PasswordHasher } from '../modules/auth/password';
import { authRoutes } from '../modules/auth/routes';
import { createAuthService } from '../modules/auth/service';
import { SessionCache } from '../modules/auth/sessionCache';
import { AccessTokens, durationMs, randomToken, type CookieConfig } from '../modules/auth/tokens';
import { priceBookFromEnv } from '../modules/billing/prices';
import { billingRoutes, stripeWebhookRoutes } from '../modules/billing/routes';
import { createBillingService } from '../modules/billing/service';
import { createBillingSync } from '../modules/billing/sync';
import { createWebhookProcessor } from '../modules/billing/webhook';
import { brandRoutes } from '../modules/brands/routes';
import { createBrandsService } from '../modules/brands/service';
import { creditRoutes } from '../modules/credits/routes';
import { healthRoutes } from '../modules/health/routes';
import { insightRoutes } from '../modules/insights/routes';
import { createInsightsService } from '../modules/insights/service';
import { meRoutes } from '../modules/me/routes';
import { metaRoutes } from '../modules/meta/routes';
import { promptRoutes } from '../modules/prompts/routes';
import { createPromptsService } from '../modules/prompts/service';
import { runRoutes } from '../modules/runs/routes';
import { scheduleRoutes } from '../modules/schedules/routes';
import { publicShareRoutes, shareRoutes } from '../modules/shares/routes';
import { createSharesService } from '../modules/shares/service';
import { surveyRoutes } from '../modules/surveys/routes';
import { buildServices, type Services } from '../services';
import { edgeProxyGuard } from './middleware/edgeProxy';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { originCheck } from './middleware/originCheck';
import {
  DEFAULT_RATE_LIMITS,
  LoginThrottle,
  globalLimiter,
  publicShareLimiter,
  type RateLimitConfig,
} from './middleware/rateLimits';
import { requestLogger } from './middleware/requestLogger';

export interface AppDeps {
  env: Env;
  logger: Logger;
  reporter: ErrorReporter;
  readiness: Readiness;
  /** Defaults to the real ones built from `env`; tests pass fakes. */
  integrations?: Integrations;
  /** Defaults to 07's table; tests raise the limits they aren't exercising. */
  rateLimits?: RateLimitConfig;
  /** Called after jobs are enqueued, so this instance's worker claims them at once. */
  onEnqueued?: () => void;
  /** Shared with the worker and scheduler (main.ts); built here when absent (tests). */
  services?: Services;
}

/**
 * Every route prefix that needs a signed-in user. Anything not listed here is public, and a test
 * checks every registered route against this list (test/routes.test.ts).
 */
export const PROTECTED_PREFIXES = [
  '/me',
  '/brands',
  '/prompts',
  '/runs',
  '/schedules',
  '/shares',
  '/credits',
  '/referrals',
  '/billing',
  '/survey',
];

/**
 * The Express app. Every route lives under `/api` (D-018): the browser calls `/api/*` on the web
 * origin and Vercel (prod) or Vite (dev) forwards it here.
 *
 * Order (01 § Request flow): helmet/cors → request id + log → rate limit → Origin check → JSON
 * body → cookies → routes (auth → ctx → zod validate → service) → error envelope.
 */
export function createApp(deps: AppDeps): Express {
  const { env, logger } = deps;
  const limits = deps.rateLimits ?? DEFAULT_RATE_LIMITS;
  const integrations = deps.integrations ?? buildIntegrations(env, logger);
  const services =
    deps.services ??
    buildServices({
      env,
      logger,
      reporter: deps.reporter,
      integrations,
      ...(deps.onEnqueued ? { onEnqueued: deps.onEnqueued } : {}),
    });

  if (!env.JWT_ACCESS_SECRET && env.NODE_ENV === 'development') {
    logger.warn('JWT_ACCESS_SECRET is not set: using a random one, so restarts sign everyone out');
  }
  const access = new AccessTokens(env.JWT_ACCESS_SECRET ?? randomToken(), env.ACCESS_TOKEN_TTL);
  const cookies: CookieConfig = {
    secure: env.NODE_ENV === 'production',
    accessTtlMs: durationMs(env.ACCESS_TOKEN_TTL),
    refreshTtlMs: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60_000,
  };
  const sessionCache = new SessionCache();
  const authGuard = requireAuth(access, sessionCache);

  const auth = createAuthService({
    env,
    logger,
    emails: services.emails,
    google: integrations.google,
    access,
    // bcrypt cost 12 (07); the test suite would spend minutes hashing at that cost.
    hasher: new PasswordHasher(env.NODE_ENV === 'test' ? 4 : 12),
    throttle: new LoginThrottle(limits.loginPerEmail),
    sessionCache,
  });
  const brands = createBrandsService({ brandAI: integrations.brandAI, logger });
  const prompts = createPromptsService({ brandAI: integrations.brandAI, logger });
  const { runs, schedules } = services;
  const shares = createSharesService({ appUrl: env.APP_URL });
  const insights = createInsightsService();
  const prices = priceBookFromEnv(env);
  const billing = createBillingService({
    gateway: integrations.billing,
    prices,
    appUrl: env.APP_URL,
    logger,
  });
  const processWebhook = createWebhookProcessor({
    sync: integrations.billing
      ? createBillingSync({
          gateway: integrations.billing,
          prices,
          logger,
          reporter: deps.reporter,
          emails: services.emails,
          appUrl: env.APP_URL,
        })
      : null,
    secret: env.STRIPE_WEBHOOK_SECRET,
    logger,
    reporter: deps.reporter,
  });

  const app = express();
  app.disable('x-powered-by');
  // Prod: browser → Vercel rewrite → Render proxy → us (07). Local: browser → Vite proxy → us.
  app.set('trust proxy', env.NODE_ENV === 'production' ? 2 : 1);

  app.use(edgeProxyGuard(env.EDGE_PROXY_SECRET));
  app.use(helmet());
  app.use(cors({ origin: env.APP_URL, credentials: true }));
  app.use(requestLogger(logger));
  app.use(globalLimiter(limits));
  app.use(originCheck(env.APP_URL));
  // Raw body for the signature check, so before express.json(); exempt from the two above.
  app.use('/api', stripeWebhookRoutes({ processWebhook }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  const api = express.Router();
  api.use(healthRoutes(deps));
  api.use(metaRoutes());
  api.use(authRoutes({ auth, access, cookies, limits, requireAuth: authGuard }));
  api.use(publicShareRoutes({ shares, limiter: publicShareLimiter(limits) }));
  api.use(PROTECTED_PREFIXES, authGuard);
  api.use(meRoutes({ auth }));
  api.use(brandRoutes({ brands, limits }));
  api.use(insightRoutes({ insights }));
  api.use(promptRoutes({ prompts, limits }));
  api.use(runRoutes({ runs, limits }));
  api.use(scheduleRoutes({ schedules, limits }));
  api.use(shareRoutes({ shares }));
  api.use(creditRoutes({ appUrl: env.APP_URL }));
  api.use(billingRoutes({ billing }));
  api.use(surveyRoutes());
  api.use(notFoundHandler);

  app.use('/api', api);
  app.use(notFoundHandler);
  app.use(errorHandler(deps.reporter, new ErrorSpikeAlarm({ logger, reporter: deps.reporter })));
  return app;
}
