import { createHash, randomBytes } from 'node:crypto';
import type { CookieOptions, Response } from 'express';
import { errors as joseErrors, jwtVerify, SignJWT } from 'jose';
import { AppError } from '../../http/errors';

/** 32 random bytes, base64url: refresh tokens, email tokens, share tokens (01 § IDs). */
export const randomToken = (): string => randomBytes(32).toString('base64url');

/** Only hashes of opaque tokens are stored. */
export const sha256 = (token: string): string => createHash('sha256').update(token).digest('hex');

const UNIT_MS = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const;

/** `15m` → 900000. The env schema already checked the format. */
export function durationMs(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value);
  if (!match) throw new Error(`not a duration: ${value}`);
  return Number(match[1]) * UNIT_MS[match[2] as keyof typeof UNIT_MS];
}

export interface AccessClaims {
  userId: string;
  workspaceId: string;
  sessionId: string;
}

/** The short-lived access JWT `{sub, wid, sid}`, HS256 (07 § Sessions). */
export class AccessTokens {
  private readonly key: Uint8Array;

  constructor(
    secret: string,
    readonly ttl: string,
  ) {
    this.key = new TextEncoder().encode(secret);
  }

  sign(claims: AccessClaims): Promise<string> {
    return new SignJWT({ wid: claims.workspaceId, sid: claims.sessionId })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(claims.userId)
      .setIssuedAt()
      .setExpirationTime(this.ttl)
      .sign(this.key);
  }

  /** Throws `TOKEN_EXPIRED` for an expired token (the client then refreshes), else `UNAUTHENTICATED`. */
  async verify(token: string): Promise<AccessClaims> {
    try {
      const { payload } = await jwtVerify(token, this.key, { algorithms: ['HS256'] });
      const { sub, wid, sid } = payload;
      if (typeof sub !== 'string' || typeof wid !== 'string' || typeof sid !== 'string') {
        throw new Error('missing claims');
      }
      return { userId: sub, workspaceId: wid, sessionId: sid };
    } catch (err) {
      if (err instanceof joseErrors.JWTExpired) {
        throw new AppError('TOKEN_EXPIRED', 'Your session expired');
      }
      throw new AppError('UNAUTHENTICATED', 'Please sign in');
    }
  }
}

// ---- Cookies (07 § Sessions): first-party, host-only, httpOnly, SameSite=Lax -----------------

export const ACCESS_COOKIE = 'pv_at';
export const REFRESH_COOKIE = 'pv_rt';
const ACCESS_PATH = '/api';
const REFRESH_PATH = '/api/auth';

export interface CookieConfig {
  /** Secure in production. Browsers treat http://localhost as secure anyway. */
  secure: boolean;
  accessTtlMs: number;
  refreshTtlMs: number;
}

const base = (cfg: CookieConfig, path: string): CookieOptions => ({
  httpOnly: true,
  secure: cfg.secure,
  sameSite: 'lax',
  path,
});

export function setAuthCookies(
  res: Response,
  cfg: CookieConfig,
  tokens: { access: string; refresh: string },
): void {
  res.cookie(ACCESS_COOKIE, tokens.access, {
    ...base(cfg, ACCESS_PATH),
    maxAge: cfg.accessTtlMs,
  });
  res.cookie(REFRESH_COOKIE, tokens.refresh, {
    ...base(cfg, REFRESH_PATH),
    maxAge: cfg.refreshTtlMs,
  });
}

export function clearAuthCookies(res: Response, cfg: CookieConfig): void {
  res.clearCookie(ACCESS_COOKIE, base(cfg, ACCESS_PATH));
  res.clearCookie(REFRESH_COOKIE, base(cfg, REFRESH_PATH));
}
