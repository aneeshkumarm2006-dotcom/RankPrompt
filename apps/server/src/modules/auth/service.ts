import type { GoogleBody, LoginBody, RegisterBody } from '@pv/shared';
import { Types } from 'mongoose';
import type { Env } from '../../config/env';
import type { Logger } from '../../config/logger';
import { withTransaction } from '../../db/transaction';
import type { EmailOutbox } from '../../emails/outbox';
import type { Ctx } from '../../http/context';
import { AppError } from '../../http/errors';
import type { LoginThrottle } from '../../http/middleware/rateLimits';
import { authTokensRepo } from '../authTokens/repo';
import { settleReferral } from '../referrals/service';
import { sessionsRepo } from '../sessions/repo';
import { usersRepo, type UserDoc } from '../users/repo';
import type { GoogleVerifier } from './google';
import type { PasswordHasher } from './password';
import type { SessionCache } from './sessionCache';
import { createAccount } from './signup';
import type { AccessTokens } from './tokens';
import { randomToken, sha256 } from './tokens';

const VERIFY_TTL_MS = 24 * 60 * 60_000;
const RESET_TTL_MS = 60 * 60_000;
/**
 * A refresh token replaced less than this long ago is answered with a plain 401 instead of being
 * treated as theft: two tabs refreshing at the same moment send the same token, and the browser
 * already holds the winner's new cookies.
 */
export const REFRESH_REUSE_GRACE_MS = 30_000;

/**
 * A refresh that lost a two-tab race inside the grace window (D-022): 401, but the response must
 * not clear the cookies the winning request just set (8.3).
 */
export class RefreshRaceError extends AppError {
  constructor() {
    super('UNAUTHENTICATED', 'Please sign in again');
  }
}

export interface ClientInfo {
  userAgent: string;
  ip: string;
}

/** A signed-in session: the cookie values plus who they belong to. */
export interface Issued {
  userId: string;
  workspaceId: string;
  access: string;
  refresh: string;
}

export interface AuthServiceDeps {
  env: Pick<Env, 'APP_URL' | 'REFRESH_TOKEN_TTL_DAYS'>;
  logger: Logger;
  emails: EmailOutbox;
  google: GoogleVerifier | null;
  access: AccessTokens;
  hasher: PasswordHasher;
  throttle: LoginThrottle;
  sessionCache: SessionCache;
}

export type AuthService = ReturnType<typeof createAuthService>;

const invalidLink = () =>
  new AppError(
    'VALIDATION_FAILED',
    'This link is invalid or has expired. Please request a new one.',
  );

export function createAuthService(deps: AuthServiceDeps) {
  const refreshTtlMs = deps.env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60_000;

  async function issue(
    userId: Types.ObjectId,
    workspaceId: Types.ObjectId,
    client: ClientInfo,
  ): Promise<Issued> {
    const sessionId = new Types.ObjectId();
    const refresh = randomToken();
    await sessionsRepo.create({
      _id: sessionId,
      userId,
      workspaceId,
      familyId: randomToken(),
      tokenHash: sha256(refresh),
      userAgent: client.userAgent.slice(0, 512),
      ip: client.ip,
      expiresAt: new Date(Date.now() + refreshTtlMs),
    });
    return {
      userId: userId.toHexString(),
      workspaceId: workspaceId.toHexString(),
      access: await deps.access.sign({
        userId: userId.toHexString(),
        workspaceId: workspaceId.toHexString(),
        sessionId: sessionId.toHexString(),
      }),
      refresh,
    };
  }

  /** Emails go out after the database work, and a failed send never fails the request. */
  function sendInBackground(promise: Promise<unknown>, what: string): void {
    promise.catch((err: unknown) => deps.logger.error({ err }, `failed to send ${what} email`));
  }

  async function sendVerification(user: Pick<UserDoc, '_id' | 'email' | 'name'>): Promise<void> {
    const token = randomToken();
    const tokenId = await authTokensRepo.issue(
      user._id,
      'verify_email',
      sha256(token),
      VERIFY_TTL_MS,
    );
    await deps.emails.send({
      template: 'verify_email',
      to: user.email,
      data: { name: user.name, link: `${deps.env.APP_URL}/verify-email?token=${token}` },
      idempotencyKey: `verify:${tokenId.toHexString()}`,
      userId: user._id,
    });
  }

  async function sendReset(user: UserDoc): Promise<void> {
    const token = randomToken();
    const tokenId = await authTokensRepo.issue(
      user._id,
      'reset_password',
      sha256(token),
      RESET_TTL_MS,
    );
    await deps.emails.send({
      template: 'reset_password',
      to: user.email,
      data: { name: user.name, link: `${deps.env.APP_URL}/reset-password?token=${token}` },
      idempotencyKey: `reset:${tokenId.toHexString()}`,
      userId: user._id,
    });
  }

  /** `welcome:<userId>`: sent once, at the first verification (or a Google sign-up). */
  function sendWelcome(user: Pick<UserDoc, '_id' | 'email' | 'name' | 'defaultWorkspaceId'>) {
    sendInBackground(
      deps.emails.send({
        template: 'welcome',
        to: user.email,
        data: { name: user.name, appLink: `${deps.env.APP_URL}/app` },
        idempotencyKey: `welcome:${user._id.toHexString()}`,
        userId: user._id,
        workspaceId: user.defaultWorkspaceId,
      }),
      'welcome',
    );
  }

  /**
   * The single place an existing account's email becomes verified (link, reset, Google linking).
   * The first verification also settles a pending referral, in the same transaction (6.4), and
   * sends the welcome email.
   */
  async function onEmailVerified(userId: Types.ObjectId): Promise<void> {
    const user = await usersRepo.findById(userId);
    if (!user || user.emailVerifiedAt) return;
    const verified = await withTransaction(async (session) => {
      if (!(await usersRepo.markEmailVerified(userId, session))) return false;
      await settleReferral(session, { userId, workspaceIds: [user.defaultWorkspaceId] });
      return true;
    });
    if (verified) sendWelcome(user);
  }

  return {
    async register(body: RegisterBody, client: ClientInfo): Promise<Issued> {
      const { userId, workspaceId } = await createAccount({
        email: body.email,
        name: body.name,
        passwordHash: await deps.hasher.hash(body.password),
        emailVerified: false,
        ref: body.ref,
      });
      const issued = await issue(userId, workspaceId, client);
      sendInBackground(
        sendVerification({ _id: userId, email: body.email, name: body.name }),
        'verification',
      );
      return issued;
    },

    /** Any failure is `INVALID_CREDENTIALS`: unknown email, wrong password, Google-only (07). */
    async login(body: LoginBody, client: ClientInfo): Promise<Issued> {
      deps.throttle.assertAllowed(body.email);
      const user = await usersRepo.findByEmail(body.email);
      const ok = await deps.hasher.verify(body.password, user?.passwordHash ?? null);
      if (!user || !ok) {
        deps.throttle.recordFailure(body.email);
        throw new AppError('INVALID_CREDENTIALS', 'Email or password is incorrect');
      }
      deps.throttle.recordSuccess(body.email);
      await usersRepo.touchLogin(user._id);
      return issue(user._id, user.defaultWorkspaceId, client);
    },

    /**
     * Google sign-in (07): sign in by Google id; else link to the account with that verified
     * email; else create a new, already verified account.
     */
    async google(body: GoogleBody, client: ClientInfo): Promise<Issued> {
      if (!deps.google) {
        throw new AppError('UPSTREAM_UNAVAILABLE', 'Google sign-in is not configured');
      }
      const id = await deps.google.verify(body.credential);
      if (!id.emailVerified) {
        throw new AppError('UNAUTHENTICATED', 'Your Google email address is not verified');
      }

      let user = await usersRepo.findByGoogleId(id.googleId);
      if (!user) {
        const existing = await usersRepo.findByEmail(id.email);
        if (existing) {
          // An account whose email was never verified may have been registered by someone else
          // with this person's address (pre-hijack, 8.3): Google proves who owns the email, so
          // the unproven password and every session made with it go.
          const unproven = existing.emailVerifiedAt === null;
          user = await usersRepo.linkGoogle(existing._id, id.googleId, id.picture, {
            dropPassword: unproven,
          });
          if (!user) {
            throw new AppError(
              'CONFLICT',
              'This email is already linked to a different Google account',
            );
          }
          if (unproven) {
            await sessionsRepo.revokeAllForUser(user._id);
            deps.sessionCache.clear();
            deps.logger.info(
              { userId: user._id.toHexString() },
              'google linked to an unverified account; its password and sessions were removed',
            );
          }
          await onEmailVerified(user._id);
        }
      }
      if (!user) {
        try {
          const created = await createAccount({
            email: id.email,
            name: id.name,
            passwordHash: null,
            googleId: id.googleId,
            avatarUrl: id.picture,
            emailVerified: true,
            ref: body.ref,
          });
          sendWelcome({
            _id: created.userId,
            email: id.email,
            name: id.name,
            defaultWorkspaceId: created.workspaceId,
          });
          return await issue(created.userId, created.workspaceId, client);
        } catch (err) {
          // Two sign-ins racing: the other one created the account first.
          if (!(err instanceof AppError && err.code === 'CONFLICT')) throw err;
          user = await usersRepo.findByGoogleId(id.googleId);
          if (!user) throw err;
        }
      }
      await usersRepo.touchLogin(user._id);
      return issue(user._id, user.defaultWorkspaceId, client);
    },

    /**
     * Rotates the refresh token (07 § Sessions). Presenting a token that was already rotated
     * (outside the short grace window) revokes its whole family: someone else has a copy.
     */
    async refresh(token: string | undefined, client: ClientInfo): Promise<Issued> {
      const expired = () => new AppError('UNAUTHENTICATED', 'Please sign in again');
      if (!token) throw expired();
      const old = await sessionsRepo.findByTokenHash(sha256(token));
      if (!old) throw expired();

      if (old.replacedBy) {
        const age = Date.now() - (old.revokedAt?.getTime() ?? 0);
        if (age > REFRESH_REUSE_GRACE_MS) {
          await sessionsRepo.revokeFamily(old.familyId);
          deps.sessionCache.clear();
          deps.logger.warn(
            { userId: old.userId.toHexString(), familyId: old.familyId },
            'refresh token reuse detected; session family revoked',
          );
        }
        // Inside the grace window it's the other tab's race: it already has the new cookies.
        throw age > REFRESH_REUSE_GRACE_MS ? expired() : new RefreshRaceError();
      }
      if (old.revokedAt || old.expiresAt.getTime() <= Date.now()) throw expired();

      const sessionId = new Types.ObjectId();
      const refresh = randomToken();
      await withTransaction(async (session) => {
        if (!(await sessionsRepo.claimForRotation(old._id, sessionId, session))) throw expired();
        await sessionsRepo.create(
          {
            _id: sessionId,
            userId: old.userId,
            workspaceId: old.workspaceId,
            familyId: old.familyId,
            tokenHash: sha256(refresh),
            userAgent: client.userAgent.slice(0, 512),
            ip: client.ip,
            expiresAt: new Date(Date.now() + refreshTtlMs),
          },
          session,
        );
      });
      deps.sessionCache.delete(old._id.toHexString());
      return {
        userId: old.userId.toHexString(),
        workspaceId: old.workspaceId.toHexString(),
        access: await deps.access.sign({
          userId: old.userId.toHexString(),
          workspaceId: old.workspaceId.toHexString(),
          sessionId: sessionId.toHexString(),
        }),
        refresh,
      };
    },

    /** Revokes the session behind the refresh cookie and/or the access token. Always succeeds. */
    async logout(refreshToken: string | undefined, sessionId: string | undefined): Promise<void> {
      if (refreshToken) {
        const s = await sessionsRepo.findByTokenHash(sha256(refreshToken));
        if (s) {
          await sessionsRepo.revoke(s._id);
          deps.sessionCache.delete(s._id.toHexString());
        }
      }
      if (sessionId && Types.ObjectId.isValid(sessionId)) {
        await sessionsRepo.revoke(new Types.ObjectId(sessionId));
        deps.sessionCache.delete(sessionId);
      }
    },

    /** "Sign out everywhere" (09 settings): every session of the user, this one included. */
    async logoutAll(ctx: Ctx): Promise<void> {
      await sessionsRepo.revokeAllForUser(new Types.ObjectId(ctx.userId));
      deps.sessionCache.clear();
    },

    async verifyEmail(token: string): Promise<void> {
      const used = await authTokensRepo.consume(sha256(token), 'verify_email');
      if (!used) throw invalidLink();
      await onEmailVerified(used.userId);
    },

    async resendVerification(ctx: Ctx): Promise<void> {
      const user = await usersRepo.findById(ctx.userId);
      if (!user || user.emailVerifiedAt) return;
      await sendVerification(user);
    },

    /** Always "ok" to the caller, whether or not the email has an account (no enumeration). */
    async forgotPassword(email: string): Promise<void> {
      const user = await usersRepo.findByEmail(email);
      if (user) sendInBackground(sendReset(user), 'password reset');
    },

    /** Sets the new password and signs the user out everywhere (07). */
    async resetPassword(token: string, password: string): Promise<void> {
      const used = await authTokensRepo.consume(sha256(token), 'reset_password');
      if (!used) throw invalidLink();
      await usersRepo.setPasswordHash(used.userId, await deps.hasher.hash(password));
      await sessionsRepo.revokeAllForUser(used.userId);
      deps.sessionCache.clear();
      // Following the emailed link proves the address.
      await onEmailVerified(used.userId);
    },

    /** Keeps the current session and revokes every other one (07). */
    async changePassword(ctx: Ctx, currentPassword: string, newPassword: string): Promise<void> {
      const user = await usersRepo.findById(ctx.userId);
      if (!user) throw new AppError('UNAUTHENTICATED', 'Please sign in');
      // Same lockout as login, keyed by user: a stolen session can't brute-force the password (8.3).
      const key = `change-password:${user._id.toHexString()}`;
      deps.throttle.assertAllowed(key);
      if (!(await deps.hasher.verify(currentPassword, user.passwordHash))) {
        deps.throttle.recordFailure(key);
        throw new AppError('INVALID_CREDENTIALS', 'Your current password is incorrect');
      }
      deps.throttle.recordSuccess(key);
      await usersRepo.setPasswordHash(user._id, await deps.hasher.hash(newPassword));
      await sessionsRepo.revokeAllForUser(user._id, new Types.ObjectId(ctx.sessionId));
      deps.sessionCache.clear();
    },
  };
}
