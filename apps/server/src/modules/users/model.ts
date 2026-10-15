import mongoose, { Schema, type Types } from 'mongoose';

/** `users` (02 § Identity). Not workspace-owned: a user reaches workspaces through memberships. */
export interface UserDoc {
  _id: Types.ObjectId;
  email: string;
  emailVerifiedAt: Date | null;
  /** bcrypt, cost 12. Null for Google-only accounts. */
  passwordHash: string | null;
  googleId: string | null;
  name: string;
  avatarUrl: string | null;
  role: 'user' | 'admin';
  defaultWorkspaceId: Types.ObjectId;
  lastLoginAt: Date | null;
  /** Non-essential email opt-outs (10 § Opt-out). Missing on old docs means "on". */
  emailPrefs?: { runCompleted: boolean; lowCredits: boolean };
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDoc>(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    emailVerifiedAt: { type: Date, default: null },
    passwordHash: { type: String, default: null },
    // No default: a stored null would collide in the unique sparse index.
    googleId: { type: String },
    name: { type: String, required: true },
    avatarUrl: { type: String, default: null },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    defaultWorkspaceId: { type: Schema.Types.ObjectId, required: true },
    lastLoginAt: { type: Date, default: null },
    emailPrefs: {
      runCompleted: { type: Boolean, default: true },
      lowCredits: { type: Boolean, default: true },
    },
  },
  { timestamps: true },
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ googleId: 1 }, { unique: true, sparse: true });

export const UserModel = mongoose.model<UserDoc>('User', userSchema, 'users');
