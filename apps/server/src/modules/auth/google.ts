import { OAuth2Client } from 'google-auth-library';
import { AppError } from '../../http/errors';

/** What we keep from a verified Google ID token. */
export interface GoogleIdentity {
  googleId: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture: string | null;
}

export interface GoogleVerifier {
  /** Throws `UNAUTHENTICATED` when the credential isn't a valid ID token for our client id. */
  verify(credential: string): Promise<GoogleIdentity>;
}

/** Verifies the ID token from `@react-oauth/google` against `GOOGLE_CLIENT_ID` (07). */
export function createGoogleVerifier(clientId: string): GoogleVerifier {
  const client = new OAuth2Client({ clientId });
  return {
    async verify(credential) {
      let payload;
      try {
        const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
        payload = ticket.getPayload();
      } catch {
        throw new AppError('UNAUTHENTICATED', 'Google sign-in failed. Please try again.');
      }
      if (!payload?.sub || !payload.email) {
        throw new AppError('UNAUTHENTICATED', 'Google sign-in failed. Please try again.');
      }
      return {
        googleId: payload.sub,
        email: payload.email.toLowerCase(),
        emailVerified: payload.email_verified === true,
        name: payload.name ?? payload.email.split('@')[0] ?? 'there',
        picture: payload.picture ?? null,
      };
    },
  };
}
