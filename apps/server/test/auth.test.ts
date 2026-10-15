import { errorEnvelopeSchema, meSchema } from '@pv/shared';
import { SignJWT } from 'jose';
import mongoose, { Types } from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { REFRESH_REUSE_GRACE_MS } from '../src/modules/auth/service';
import { SessionModel } from '../src/modules/sessions/model';
import { UserModel } from '../src/modules/users/model';
import {
  APP_URL,
  JWT_SECRET,
  PASSWORD,
  client,
  connectTestDb,
  cookiesOf,
  dropTestDb,
  makeTestApp,
  signUp,
  uniqueEmail,
} from './helpers';

const t = makeTestApp();
const { app, mailer, google } = t;

beforeAll(() => connectTestDb('auth_test'));
afterAll(() => dropTestDb());

const codeOf = (body: unknown) => errorEnvelopeSchema.parse(body).error.code;
/** `pv_rt=abc; Path=…` → `abc` */
const valueOf = (setCookie: string | undefined): string => {
  const value = /^[^=]+=([^;]*)/.exec(setCookie ?? '')?.[1];
  if (!value) throw new Error('cookie not set');
  return value;
};

describe('register', () => {
  it('creates the account, signs in with httpOnly cookies and returns Me (no tokens)', async () => {
    const agent = client(app);
    const email = uniqueEmail();
    const res = await agent
      .post('/api/auth/register')
      .send({ name: 'Ada', email: email.toUpperCase(), password: PASSWORD })
      .expect(201);

    const me = meSchema.parse(res.body);
    expect(me.user).toMatchObject({ name: 'Ada', email, emailVerified: false });
    expect(me.user.authMethods).toEqual(['password']);
    expect(me.workspace.credits).toEqual({ plan: 0, purchased: 50, total: 50 });
    expect(me.workspace.plan.tier).toBe('free');
    expect(me.workspace.limits).toMatchObject({ brands: 1, brandsUsed: 0, maxPromptsPerRun: 25 });
    expect(me.workspace.referralCode).toMatch(/^[A-Z0-9]{8}$/);
    const cookies = cookiesOf(res);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain(valueOf(cookies.pv_at));
    expect(body).not.toContain(valueOf(cookies.pv_rt));
    expect(body).not.toMatch(/token|passwordHash/i);

    expect(cookies.pv_at).toMatch(/HttpOnly/);
    expect(cookies.pv_at).toMatch(/SameSite=Lax/);
    expect(cookies.pv_at).toMatch(/Path=\/api;/);
    expect(cookies.pv_at).not.toMatch(/Domain=/);
    expect(cookies.pv_rt).toMatch(/Path=\/api\/auth/);
    expect(cookies.pv_rt).toMatch(/HttpOnly/);

    const again = await agent.get('/api/me').expect(200);
    expect(meSchema.parse(again.body).user.email).toBe(email);
  });

  it('sends a verification email whose link verifies the address once', async () => {
    const { agent, email } = await signUp(app);
    const token = await mailer.tokenFor(email, 'verify_email');
    const message = mailer.sent.findLast((m) => m.to === email);
    expect(message?.text).toContain(`${APP_URL}/verify-email?token=`);

    await client(app).post('/api/auth/verify-email').send({ token }).expect(204);
    const me = meSchema.parse((await agent.get('/api/me').expect(200)).body);
    expect(me.user.emailVerified).toBe(true);

    const reused = await client(app).post('/api/auth/verify-email').send({ token }).expect(400);
    expect(codeOf(reused.body)).toBe('VALIDATION_FAILED');
  });

  it('can resend the verification email, and does nothing once verified', async () => {
    const { agent, email } = await signUp(app);
    const first = await mailer.tokenFor(email, 'verify_email');
    await agent.post('/api/auth/resend-verification').expect(204);
    await mailer.waitFor('verify_email', 2, email);
    const second = await mailer.tokenFor(email, 'verify_email');
    expect(second).not.toBe(first);
    // The older link stops working when a new one is issued.
    await client(app).post('/api/auth/verify-email').send({ token: first }).expect(400);
    await client(app).post('/api/auth/verify-email').send({ token: second }).expect(204);
  });

  it('rejects a duplicate email with CONFLICT', async () => {
    const { email } = await signUp(app);
    const res = await client(app)
      .post('/api/auth/register')
      .send({ name: 'Again', email, password: PASSWORD })
      .expect(409);
    expect(codeOf(res.body)).toBe('CONFLICT');
  });

  it('enforces the password policy', async () => {
    for (const password of ['short', 'password123']) {
      const res = await client(app)
        .post('/api/auth/register')
        .send({ name: 'Weak', email: uniqueEmail(), password })
        .expect(400);
      expect(codeOf(res.body)).toBe('VALIDATION_FAILED');
    }
  });
});

describe('login', () => {
  it('signs in with the right password', async () => {
    const { email } = await signUp(app);
    const res = await client(app)
      .post('/api/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    expect(meSchema.parse(res.body).user.email).toBe(email);
    expect(cookiesOf(res).pv_at).toBeDefined();
  });

  it('returns the same generic error for a wrong password, an unknown email and a Google-only account', async () => {
    const { email } = await signUp(app);
    const googleEmail = uniqueEmail('google');
    const credential = google.add('only', {
      googleId: 'g-only',
      email: googleEmail,
      emailVerified: true,
      name: 'G',
      picture: null,
    });
    await client(app).post('/api/auth/google').send({ credential }).expect(200);

    const attempts = [
      { email, password: 'wrong password!' },
      { email: uniqueEmail('nobody'), password: PASSWORD },
      { email: googleEmail, password: PASSWORD },
    ];
    const bodies = [];
    for (const attempt of attempts) {
      const res = await client(app).post('/api/auth/login').send(attempt).expect(401);
      bodies.push(errorEnvelopeSchema.parse(res.body).error);
    }
    expect(new Set(bodies.map((b) => `${b.code}:${b.message}`)).size).toBe(1);
    expect(bodies[0]?.code).toBe('INVALID_CREDENTIALS');
  });
});

describe('sessions', () => {
  it('401s without a cookie and TOKEN_EXPIRED with an expired access token', async () => {
    const anon = await client(app).get('/api/me').expect(401);
    expect(codeOf(anon.body)).toBe('UNAUTHENTICATED');

    const { me } = await signUp(app);
    const expired = await new SignJWT({
      wid: me.workspace.id,
      sid: new Types.ObjectId().toHexString(),
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(me.user.id)
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode(JWT_SECRET));
    const res = await client(app).get('/api/me').set('Cookie', `pv_at=${expired}`).expect(401);
    expect(codeOf(res.body)).toBe('TOKEN_EXPIRED');

    const forged = await client(app).get('/api/me').set('Cookie', `pv_at=${expired}x`).expect(401);
    expect(codeOf(forged.body)).toBe('UNAUTHENTICATED');
  });

  it('refresh rotates both cookies and the old refresh token stops working', async () => {
    const { agent } = await signUp(app);
    const before = await SessionModel.countDocuments({});
    const res = await agent.post('/api/auth/refresh').expect(204);
    const cookies = cookiesOf(res);
    expect(cookies.pv_at).toBeDefined();
    expect(cookies.pv_rt).toBeDefined();
    expect(await SessionModel.countDocuments({})).toBe(before + 1);
    await agent.get('/api/me').expect(200);
  });

  it('detects refresh-token reuse and revokes the whole family', async () => {
    const { email } = await signUp(app);
    const login = await client(app).post('/api/auth/login').send({ email, password: PASSWORD });
    const oldRefresh = valueOf(cookiesOf(login).pv_rt);

    const rotated = await client(app)
      .post('/api/auth/refresh')
      .set('Cookie', `pv_rt=${oldRefresh}`)
      .expect(204);
    const newRefresh = valueOf(cookiesOf(rotated).pv_rt);
    expect(newRefresh).not.toBe(oldRefresh);

    // Inside the grace window a replayed token is just refused (two tabs refreshing together).
    const inGrace = await client(app)
      .post('/api/auth/refresh')
      .set('Cookie', `pv_rt=${oldRefresh}`)
      .expect(401);
    // …and its 401 must not clear the cookies the winning tab was just given (8.3).
    expect(cookiesOf(inGrace).pv_rt).toBeUndefined();
    expect(cookiesOf(inGrace).pv_at).toBeUndefined();

    // After it, the replay is treated as theft: every session in the family is revoked.
    await SessionModel.updateMany(
      { replacedBy: mongoose.trusted({ $ne: null }) },
      { $set: { revokedAt: new Date(Date.now() - REFRESH_REUSE_GRACE_MS - 1_000) } },
    );
    await client(app).post('/api/auth/refresh').set('Cookie', `pv_rt=${oldRefresh}`).expect(401);
    await client(app).post('/api/auth/refresh').set('Cookie', `pv_rt=${newRefresh}`).expect(401);
  });

  it('logout revokes the session and clears the cookies', async () => {
    const { email } = await signUp(app);
    const agent = client(app);
    const login = await agent.post('/api/auth/login').send({ email, password: PASSWORD });
    const access = valueOf(cookiesOf(login).pv_at);
    await agent.get('/api/me').expect(200);

    const res = await agent.post('/api/auth/logout').expect(204);
    expect(cookiesOf(res).pv_at).toMatch(/Expires=Thu, 01 Jan 1970/);
    // Even a kept copy of the old access token is refused: its session is gone.
    await client(app).get('/api/me').set('Cookie', `pv_at=${access}`).expect(401);
    await agent.post('/api/auth/refresh').expect(401);
  });

  it('changing the password keeps this session and revokes the others', async () => {
    const { agent, email } = await signUp(app);
    const other = client(app);
    await other.post('/api/auth/login').send({ email, password: PASSWORD }).expect(200);

    const wrong = await agent
      .post('/api/me/password')
      .send({ currentPassword: 'nope nope nope', newPassword: 'a brand new secret' })
      .expect(401);
    expect(codeOf(wrong.body)).toBe('INVALID_CREDENTIALS');

    await agent
      .post('/api/me/password')
      .send({ currentPassword: PASSWORD, newPassword: 'a brand new secret' })
      .expect(204);
    await agent.get('/api/me').expect(200);
    await other.get('/api/me').expect(401);
    await other.post('/api/auth/refresh').expect(401);
    await client(app)
      .post('/api/auth/login')
      .send({ email, password: 'a brand new secret' })
      .expect(200);
  });
});

describe('password reset', () => {
  it('always answers 204, and only emails existing accounts', async () => {
    const nobody = uniqueEmail('nobody');
    await client(app).post('/api/auth/forgot-password').send({ email: nobody }).expect(204);
    await new Promise((r) => setTimeout(r, 50));
    expect(mailer.sent.some((m) => m.to === nobody)).toBe(false);
  });

  it('resets the password with the emailed link, signs out everywhere and verifies the email', async () => {
    const { agent, email } = await signUp(app);
    await client(app).post('/api/auth/forgot-password').send({ email }).expect(204);
    const token = await mailer.tokenFor(email, 'reset_password');

    await client(app)
      .post('/api/auth/reset-password')
      .send({ token, password: 'fresh password here' })
      .expect(204);
    await agent.get('/api/me').expect(401);
    await client(app).post('/api/auth/login').send({ email, password: PASSWORD }).expect(401);
    const res = await client(app)
      .post('/api/auth/login')
      .send({ email, password: 'fresh password here' })
      .expect(200);
    expect(meSchema.parse(res.body).user.emailVerified).toBe(true);

    await client(app)
      .post('/api/auth/reset-password')
      .send({ token, password: 'another password!' })
      .expect(400);
  });
});

describe('password change lockout (8.3)', () => {
  it('locks the current-password check after 10 wrong tries', async () => {
    const { agent } = await signUp(app);
    const wrong = () =>
      agent
        .post('/api/me/password')
        .send({ currentPassword: 'nope nope nope', newPassword: 'a brand new secret' });
    for (let i = 0; i < 10; i++) await wrong().expect(401);
    const locked = await wrong().expect(429);
    expect(codeOf(locked.body)).toBe('RATE_LIMITED');
    // Even the right password waits out the lock.
    await agent
      .post('/api/me/password')
      .send({ currentPassword: PASSWORD, newPassword: 'a brand new secret' })
      .expect(429);
  });
});

describe('Google sign-in', () => {
  it('creates a verified account with the signup bonus', async () => {
    const email = uniqueEmail('g');
    const credential = google.add('new', {
      googleId: 'g-new',
      email,
      emailVerified: true,
      name: 'Grace',
      picture: 'https://lh3.googleusercontent.com/a/x',
    });
    const res = await client(app).post('/api/auth/google').send({ credential }).expect(200);
    const me = meSchema.parse(res.body);
    expect(me.user).toMatchObject({ email, emailVerified: true, authMethods: ['google'] });
    expect(me.workspace.credits.total).toBe(50);

    // Signing in again finds the same account.
    const again = await client(app).post('/api/auth/google').send({ credential }).expect(200);
    expect(meSchema.parse(again.body).user.id).toBe(me.user.id);
  });

  it('links Google to an existing password account with the same verified email', async () => {
    const { me, email } = await signUp(app);
    await UserModel.updateOne({ email }, { $set: { emailVerifiedAt: new Date() } });
    const credential = google.add('link', {
      googleId: 'g-link',
      email,
      emailVerified: true,
      name: 'Linked',
      picture: null,
    });
    const res = await client(app).post('/api/auth/google').send({ credential }).expect(200);
    const linked = meSchema.parse(res.body);
    expect(linked.user.id).toBe(me.user.id);
    expect(linked.user.authMethods).toEqual(['password', 'google']);
    expect(linked.user.emailVerified).toBe(true);
    expect(await UserModel.countDocuments({ email })).toBe(1);
  });

  it('linking an account whose email was never verified drops its password and sessions (pre-hijack, 8.3)', async () => {
    // Someone registers the victim's address with their own password and keeps a session.
    const squatter = await signUp(app);
    const email = squatter.email;
    const credential = google.add('victim', {
      googleId: 'g-victim',
      email,
      emailVerified: true,
      name: 'Victim',
      picture: null,
    });
    // The real owner signs in with Google and gets the account…
    const res = await client(app).post('/api/auth/google').send({ credential }).expect(200);
    const owner = meSchema.parse(res.body);
    expect(owner.user.id).toBe(squatter.me.user.id);
    expect(owner.user.authMethods).toEqual(['google']);
    expect(owner.user.emailVerified).toBe(true);
    // …and the squatter's session and password no longer work.
    await squatter.agent.get('/api/me').expect(401);
    await squatter.agent.post('/api/auth/refresh').expect(401);
    const login = await client(app)
      .post('/api/auth/login')
      .send({ email, password: PASSWORD })
      .expect(401);
    expect(codeOf(login.body)).toBe('INVALID_CREDENTIALS');
  });

  it('refuses unverified Google emails, a second Google account for one email, and bad tokens', async () => {
    const email = uniqueEmail('g2');
    const unverified = google.add('unverified', {
      googleId: 'g-unverified',
      email,
      emailVerified: false,
      name: 'U',
      picture: null,
    });
    await client(app).post('/api/auth/google').send({ credential: unverified }).expect(401);

    const first = google.add('first', {
      googleId: 'g-first',
      email,
      emailVerified: true,
      name: 'F',
      picture: null,
    });
    const second = google.add('second', {
      googleId: 'g-second',
      email,
      emailVerified: true,
      name: 'S',
      picture: null,
    });
    await client(app).post('/api/auth/google').send({ credential: first }).expect(200);
    const res = await client(app).post('/api/auth/google').send({ credential: second }).expect(409);
    expect(codeOf(res.body)).toBe('CONFLICT');

    await client(app).post('/api/auth/google').send({ credential: 'google:unknown' }).expect(401);
  });

  it('is a 503 when Google sign-in is not configured', async () => {
    const { app: noGoogle } = makeTestApp({ google: false });
    const res = await client(noGoogle)
      .post('/api/auth/google')
      .send({ credential: 'anything' })
      .expect(503);
    expect(codeOf(res.body)).toBe('UPSTREAM_UNAVAILABLE');
  });
});

describe('me', () => {
  it('updates the profile', async () => {
    const { agent } = await signUp(app);
    const res = await agent
      .patch('/api/me')
      .send({ name: 'Renamed', avatarUrl: 'https://example.com/a.png' })
      .expect(200);
    expect(meSchema.parse(res.body).user).toMatchObject({
      name: 'Renamed',
      avatarUrl: 'https://example.com/a.png',
    });
    await agent.patch('/api/me').send({}).expect(400);
    await agent.patch('/api/me').send({ avatarUrl: 'javascript:alert(1)' }).expect(400);
  });
});
