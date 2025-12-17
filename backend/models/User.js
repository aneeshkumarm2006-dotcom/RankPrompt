import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a name'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'Please provide an email'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
  },
  password: {
    type: String,
    minlength: [6, 'Password must be at least 6 characters'],
    select: false, // Don't return password by default
  },
  authProvider: {
    type: String,
    enum: ['local', 'google'],
    default: 'local',
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true, // Allow null values
  },
  credits: {
    type: Number,
    default: 0,
  },
  allowedModels: {
    type: [String],
    default: ['chatgpt'],
  },
  stripeCustomerId: {
    type: String,
    default: null,
  },
  stripeSubscriptionId: {
    type: String,
    default: null,
  },
  subscriptionStatus: {
    type: String,
    enum: ['active', 'canceled', 'past_due', 'inactive'],
    default: 'inactive',
  },
  currentPlan: {
    type: String,
    enum: ['free', 'starter', 'pro', 'agency'],
    default: 'free',
  },
  subscriptionTier: {
    type: String,
    enum: ['free', 'starter', 'pro', 'agency'],
    default: 'free',
  },
  creditsUsed: {
    type: Number,
    default: 0,
  },
  currentPlanPeriodEnd: {
    type: Date,
    default: null,
  },
  // Referral System
  referralCode: {
    type: String,
    unique: true,
    sparse: true, // Allow null/undefined values, only enforce uniqueness on existing values
  },
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  referralCount: {
    type: Number,
    default: 0,
  },
  // Survey
  surveyCompleted: {
    type: Boolean,
    default: false,
  },
  surveyCompletedAt: {
    type: Date,
    default: null,
  },
  avatar: {
    type: String,
    default: null,
  },
  isEmailVerified: {
    type: Boolean,
    default: false,
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },
  refreshToken: {
    type: String,
    select: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastLogin: {
    type: Date,
    default: Date.now,
  },
});

// Generate referral code and hash password before saving
userSchema.pre('save', async function (next) {
  // Generate referral code only for NEW users without one
  if (this.isNew && !this.referralCode) {
    const crypto = await import('crypto');
    let isUnique = false;
    let code;
    
    while (!isUnique) {
      code = crypto.randomBytes(4).toString('hex').toUpperCase();
      const existing = await mongoose.models.User.findOne({ referralCode: code });
      if (!existing) {
        isUnique = true;
      }
    }
    
    this.referralCode = code;
  }

  // Only hash if password is modified or new
  if (!this.isModified('password')) {
    return next();
  }

  // Don't hash if using OAuth
  if (this.authProvider !== 'local' || !this.password) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) {
    return false;
  }
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to get public profile
userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  delete user.refreshToken;
  delete user.__v;
  return user;
};

const User = mongoose.model('User', userSchema);

export default User;
