import mongoose from 'mongoose';
import dotenv from 'dotenv';
import crypto from 'crypto';
import User from '../models/User.js';

dotenv.config();

/**
 * Migration script to generate referral codes for existing users
 * Run this once: node scripts/generateReferralCodes.js
 */

const generateReferralCodes = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB Connected');

    // Find all users without referral codes
    const usersWithoutCodes = await User.find({ 
      $or: [
        { referralCode: null },
        { referralCode: { $exists: false } }
      ]
    });

    if (usersWithoutCodes.length === 0) {
      process.exit(0);
    }

    let updated = 0;
    const existingCodes = new Set(
      (await User.find({ referralCode: { $exists: true, $ne: null } })
        .select('referralCode'))
        .map(u => u.referralCode)
    );

    for (const user of usersWithoutCodes) {
      // Generate unique code
      let code;
      let isUnique = false;

      while (!isUnique) {
        code = crypto.randomBytes(4).toString('hex').toUpperCase();
        if (!existingCodes.has(code)) {
          isUnique = true;
          existingCodes.add(code);
        }
      }

      // Update user
      user.referralCode = code;
      await user.save();
      updated++;
    }
    process.exit(0);
  } catch (error) {
    console.error('❌ Error generating referral codes:', error);
    process.exit(1);
  }
};

generateReferralCodes();
