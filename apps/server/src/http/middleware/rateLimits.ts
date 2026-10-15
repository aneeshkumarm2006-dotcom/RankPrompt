import type { Request, RequestHandler } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { AppError } from '../errors';
import { CSRF_EXEMPT_PATHS } from './originCheck';

/**
 * Rate limits (07 § Rate limiting). Counters live in memory per instance, which is fine for one
 * or two instances. Tests raise the limits they aren't exercising.
 */
export interface Window {
  limit: number;
  windowMs: number;
}

export interface RateLimitConfig {
  /** Every /api request, per IP. */
  global: Window;
  /** POST /auth/login and /auth/register, per IP. */
  authPerIp: Window;
  /** Failed logins per email before a lockout; each further lockout doubles, up to `maxLockMs`. */
  loginPerEmail: Window & { maxLockMs: number };
  /** /auth/forgot-password per email, and /auth/resend-verification per user. */
  emailSendsPerKey: Window;
  /** Endpoints that cost money (analyze, generate, runs), per workspace. */
  costlyPerWorkspace: Window;
  /** GET /public/shares/:token, per IP. */
  publicSharePerIp: Window;
}

const MIN = 60_000;
const HOUR = 60 * MIN;

export const DEFAULT_RATE_LIMITS: RateLimitConfig = {
  global: { limit: 300, windowMs: 5 * MIN },
  authPerIp: { limit: 20, windowMs: 15 * MIN },
  loginPerEmail: { limit: 10, windowMs: 15 * MIN, maxLockMs: 24 * HOUR },
  emailSendsPerKey: { limit: 3, windowMs: HOUR },
  costlyPerWorkspace: { limit: 30, windowMs: HOUR },
  publicSharePerIp: { limit: 60, windowMs: MIN },
};

const tooMany = (): AppError =>
  new AppError('RATE_LIMITED', 'Too many requests. Please wait a moment and try again.');

function limiter(
  window: Window,
  opts: { keyGenerator?: (req: Request) => string; skip?: (req: Request) => boolean } = {},
): RequestHandler {
  return rateLimit({
    windowMs: window.windowMs,
    limit: window.limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    ...opts,
    handler: (_req, _res, next) => next(tooMany()),
  });
}

export const globalLimiter = (cfg: RateLimitConfig): RequestHandler =>
  limiter(cfg.global, { skip: (req) => CSRF_EXEMPT_PATHS.has(req.path) });

/**
 * The address that connected to the platform proxy in front of us: the last `X-Forwarded-For`
 * entry (Render appends it), else the socket. Unlike `req.ip` (trust proxy 2, the client as the
 * Vercel rewrite reports it), a request sent straight to the Render URL can't forge it (8.3).
 */
export function hopIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  const list = (Array.isArray(xff) ? xff.join(',') : (xff ?? '')).split(',');
  const last = list[list.length - 1]?.trim();
  return last || req.socket.remoteAddress || '';
}

/**
 * Login / register / Google, per client IP (07), plus a backstop per hop IP at 10× the limit.
 * The client IP comes from `X-Forwarded-For`, which a request sent straight to the Render URL
 * can forge; the hop can't be forged, but everyone behind one Vercel edge shares it, hence 10×.
 */
export const authIpLimiter = (cfg: RateLimitConfig): RequestHandler => {
  const byClient = limiter(cfg.authPerIp);
  const byHop = limiter(
    { ...cfg.authPerIp, limit: cfg.authPerIp.limit * 10 },
    { keyGenerator: (req) => `hop:${ipKeyGenerator(hopIp(req))}` },
  );
  return (req, res, next) => {
    void byClient(req, res, (err?: unknown) => {
      if (err) next(err);
      else void byHop(req, res, next);
    });
  };
};

export const publicShareLimiter = (cfg: RateLimitConfig): RequestHandler =>
  limiter(cfg.publicSharePerIp);

/** Keyed by the (lowercased) `email` in the body; requests without one fall through. */
export const emailLimiter = (cfg: RateLimitConfig, scope: string): RequestHandler =>
  limiter(cfg.emailSendsPerKey, {
    keyGenerator: (req) => `${scope}:${emailOf(req)}`,
    skip: (req) => emailOf(req) === '',
  });

/** Keyed by the signed-in user (mount behind requireAuth). */
export const userLimiter = (cfg: RateLimitConfig, scope: string): RequestHandler =>
  limiter(cfg.emailSendsPerKey, { keyGenerator: (req) => `${scope}:${req.ctx?.userId ?? ''}` });

/** Keyed by workspace (mount behind requireAuth). One instance per route. */
export const workspaceLimiter = (cfg: RateLimitConfig): RequestHandler =>
  limiter(cfg.costlyPerWorkspace, { keyGenerator: (req) => `ws:${req.ctx?.workspaceId ?? ''}` });

function emailOf(req: Request): string {
  const email = (req.body as { email?: unknown } | undefined)?.email;
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

/**
 * Login lockout per email (07): after `limit` failures within `windowMs` the email is locked for
 * `windowMs`, and every further lockout doubles that, up to `maxLockMs`. A success clears it.
 */
export class LoginThrottle {
  private readonly entries = new Map<
    string,
    { failures: number[]; lockouts: number; lockedUntil: number; touched: number }
  >();

  constructor(
    private readonly cfg: RateLimitConfig['loginPerEmail'],
    private readonly now: () => number = Date.now,
  ) {}

  /** Throws RATE_LIMITED while the email is locked. */
  assertAllowed(email: string): void {
    const entry = this.entries.get(email);
    if (entry && entry.lockedUntil > this.now()) {
      throw new AppError(
        'RATE_LIMITED',
        'Too many failed sign-in attempts. Please try again later or reset your password.',
        { retryAfterSeconds: Math.ceil((entry.lockedUntil - this.now()) / 1000) },
      );
    }
  }

  recordFailure(email: string): void {
    const now = this.now();
    this.prune(now);
    const entry = this.entries.get(email) ?? {
      failures: [],
      lockouts: 0,
      lockedUntil: 0,
      touched: now,
    };
    entry.touched = now;
    entry.failures = entry.failures.filter((t) => now - t < this.cfg.windowMs);
    entry.failures.push(now);
    if (entry.failures.length >= this.cfg.limit) {
      entry.lockouts += 1;
      const lockMs = Math.min(this.cfg.windowMs * 2 ** (entry.lockouts - 1), this.cfg.maxLockMs);
      entry.lockedUntil = now + lockMs;
      entry.failures = [];
    }
    this.entries.set(email, entry);
  }

  recordSuccess(email: string): void {
    this.entries.delete(email);
  }

  /** Forget emails idle for a day, so the map can't grow without bound. */
  private prune(now: number): void {
    if (this.entries.size < 10_000) return;
    for (const [email, entry] of this.entries) {
      if (entry.lockedUntil < now && now - entry.touched > this.cfg.maxLockMs) {
        this.entries.delete(email);
      }
    }
  }
}
