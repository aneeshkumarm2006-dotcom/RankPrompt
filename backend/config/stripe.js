import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

export const STRIPE_CONFIG = {
  publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
};

export const PLAN_CONFIG = {
  starter: {
    priceId: process.env.STRIPE_PRICE_ID_STARTER,
    credits: 150,
    allowedModels: ['chatgpt', 'perplexity', 'google_ai_overview'],
  },
  pro: {
    priceId: process.env.STRIPE_PRICE_ID_PRO,
    credits: 500,
    allowedModels: ['chatgpt', 'perplexity', 'google_ai_overview'],
  },
  agency: {
    priceId: process.env.STRIPE_PRICE_ID_AGENCY,
    credits: 1000,
    allowedModels: ['chatgpt', 'perplexity', 'google_ai_overview'],
  },
};

export const TOPUP_CONFIG = {
  topup50: {
    priceId: process.env.STRIPE_TOPUP_PRICE_ID_50,
    credits: 50,
  },
  topup100: {
    priceId: process.env.STRIPE_TOPUP_PRICE_ID_100,
    credits: 100,
  },
  topup200: {
    priceId: process.env.STRIPE_TOPUP_PRICE_ID_200,
    credits: 200,
  },
};
