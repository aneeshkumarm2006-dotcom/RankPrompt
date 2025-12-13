import express from 'express';
import {
  createCheckoutSession,
  createTopUpSession,
  createBillingPortalSession,
  handleWebhook,
  getSubscriptionInfo,
} from '../controllers/stripeController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Webhook must receive raw body
router.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);

// JSON parsing for other routes
router.use(express.json());

// Protected routes
router.post('/create-checkout-session', protect, createCheckoutSession);
router.post('/create-topup-session', protect, createTopUpSession);
router.post('/create-billing-portal-session', protect, createBillingPortalSession);
router.get('/subscription-info', protect, getSubscriptionInfo);

export default router;
