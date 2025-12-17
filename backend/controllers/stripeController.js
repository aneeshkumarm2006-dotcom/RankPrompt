import { stripe, PLAN_CONFIG, TOPUP_CONFIG } from '../config/stripe.js';
import User from '../models/User.js';
import CreditLog from '../models/CreditLog.js';

const successUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/profile?session_id={CHECKOUT_SESSION_ID}`;
const cancelUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/profile?canceled=true`;

/**
 * Create Checkout Session for Subscription
 */
export const createCheckoutSession = async (req, res) => {
  try {
    const { planKey } = req.body;
    const userId = req.user.id;
    const customerEmail = req.user.email;

    const plan = PLAN_CONFIG[planKey];
    if (!plan) {
      return res.status(400).json({ success: false, message: 'Invalid plan selected' });
    }

    if (!plan.priceId) {
      return res.status(500).json({ success: false, message: 'Billing is not configured for this plan' });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: plan.priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: customerEmail,
      metadata: { userId, planType: planKey },
      subscription_data: { metadata: { userId, planType: planKey } },
    });

    return res.status(200).json({ success: true, sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create checkout session' });
  }
};

/**
 * Create Checkout Session for Credit Top-up (One-time)
 */
export const createTopUpSession = async (req, res) => {
  try {
    const { topupKey } = req.body;
    const userId = req.user.id;
    const customerEmail = req.user.email;

    const topup = TOPUP_CONFIG[topupKey];
    if (!topup) {
      return res.status(400).json({ success: false, message: 'Invalid top-up option' });
    }

    if (!topup.priceId) {
      return res.status(500).json({ success: false, message: 'Billing is not configured for this top-up option' });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{ price: topup.priceId, quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/profile?topup=success&credits=${topup.credits}`,
      cancel_url: cancelUrl,
      customer_email: customerEmail,
      metadata: { userId, credits: topup.credits, type: 'topup' },
    });

    return res.status(200).json({ success: true, sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Stripe topup error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create topup session' });
  }
};

/**
 * Create Billing Portal Session
 */
export const createBillingPortalSession = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user?.stripeCustomerId) {
      return res.status(400).json({ success: false, message: 'No Stripe customer found' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/profile`,
    });

    return res.status(200).json({ success: true, url: session.url });
  } catch (error) {
    console.error('Billing portal error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create billing portal session' });
  }
};

/**
 * Get subscription info for authenticated user
 */
export const getSubscriptionInfo = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user?.stripeSubscriptionId) {
      return res.status(200).json({ success: true, subscription: null });
    }

    const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
    return res.status(200).json({
      success: true,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        currentPeriodEnd: subscription.current_period_end,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
    });
  } catch (error) {
    console.error('Get subscription error:', error);
    return res.status(500).json({ success: false, message: 'Failed to get subscription info' });
  }
};

/**
 * Stripe Webhook handler
 */
export const handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;
      default:
        break;
    }
  } catch (err) {
    console.error('Webhook handler error:', err);
    return res.status(500).send('Webhook handler failed');
  }

  return res.json({ received: true });
};

async function handleCheckoutCompleted(session) {
  const userId = session.metadata?.userId;
  if (!userId) return;

  if (session.mode === 'subscription') {
    const subscription = await stripe.subscriptions.retrieve(session.subscription);
    const planKey = session.metadata?.planType;
    const plan = PLAN_CONFIG[planKey];
    const user = await User.findById(userId);
    const currentCredits = user?.credits || 0;
    const update = {
      stripeCustomerId: session.customer,
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: 'active',
      currentPlan: planKey || 'free',
      subscriptionTier: planKey || 'free',
      credits: (plan?.credits ?? 0) + currentCredits,
      allowedModels: plan?.allowedModels ?? undefined,
      currentPlanPeriodEnd: subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null,
      creditsUsed: 0,
    };
    const updated = await User.findByIdAndUpdate(userId, update, { new: true });
    // Log credit grant
    if (plan?.credits) {
      await CreditLog.create({
        user: userId,
        amount: plan.credits,
        type: 'purchased',
        source: 'subscription',
        description: `Subscribed to ${planKey}`,
        metadata: { plan: planKey, subscriptionId: subscription.id },
        balanceAfter: updated?.credits ?? (plan.credits + currentCredits),
      });
    }
  } else if (session.metadata?.type === 'topup') {
    const credits = parseInt(session.metadata?.credits, 10) || 0;
    if (credits > 0) {
      const updated = await User.findByIdAndUpdate(
        userId,
        {
          $inc: { credits },
          stripeCustomerId: session.customer,
        },
        { new: true }
      );
      await CreditLog.create({
        user: userId,
        amount: credits,
        type: 'purchased',
        source: 'purchase',
        description: `Top-up ${credits} credits`,
        metadata: { topup: true },
        balanceAfter: updated?.credits ?? credits,
      });
    }
  }
}

async function handleSubscriptionUpdate(subscription) {
  const userId = subscription.metadata?.userId;
  if (!userId) return;

  const planKey = subscription.metadata?.planType;
  const plan = PLAN_CONFIG[planKey];

  await User.findByIdAndUpdate(userId, {
    subscriptionStatus: subscription.status,
    currentPlan: planKey || 'free',
    subscriptionTier: planKey || 'free',
    allowedModels: plan?.allowedModels ?? undefined,
    credits: plan?.credits ?? 0,
    creditsUsed: 0,
    currentPlanPeriodEnd: subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null,
  });
}

async function handleSubscriptionDeleted(subscription) {
  const userId = subscription.metadata?.userId;
  if (!userId) return;

  await User.findByIdAndUpdate(userId, {
    subscriptionStatus: 'canceled',
    currentPlan: 'free',
    subscriptionTier: 'free',
    allowedModels: ['chatgpt'],
    stripeSubscriptionId: null,
    credits: 0,
    creditsUsed: 0,
  });
}

async function handlePaymentSucceeded(invoice) {
  console.log('Payment succeeded:', invoice.id);
}

async function handlePaymentFailed(invoice) {
  console.log('Payment failed:', invoice.id);
}
