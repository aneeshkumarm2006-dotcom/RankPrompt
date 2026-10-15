import mongoose, { Schema, type Types } from 'mongoose';

export const AUTH_TOKEN_TYPES = ['verify_email', 'reset_password'] as const;
export type AuthTokenType = (typeof AUTH_TOKEN_TYPES)[number];

/** `auth_tokens` (02): single-use email verification and password reset tokens, stored hashed. */
export interface AuthTokenDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  type: AuthTokenType;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const authTokenSchema = new Schema<AuthTokenDoc>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    type: { type: String, enum: AUTH_TOKEN_TYPES, required: true },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
authTokenSchema.index({ tokenHash: 1 }, { unique: true });
authTokenSchema.index({ userId: 1, type: 1 });
authTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AuthTokenModel = mongoose.model<AuthTokenDoc>(
  'AuthToken',
  authTokenSchema,
  'auth_tokens',
);
