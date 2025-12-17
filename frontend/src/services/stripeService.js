const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Create a Stripe Checkout Session for subscription
 * @param {string} priceId - Stripe price ID
 * @param {string} planType - Plan type (e.g., 'pro_monthly', 'pro_yearly')
 * @returns {Promise<object>} Response data
 */
export const createCheckoutSession = async (planKey) => {
  try {
    const response = await fetch(`${API_URL}/stripe/create-checkout-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        planKey,
      }),
    });

    const data = await response.json();
    
    if (data.success) {
      // Redirect to Stripe Checkout
      window.location.href = data.url;
    }
    
    return data;
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw error;
  }
};

/**
 * Create a Stripe Checkout Session for credit top-up (one-time payment)
 * @param {string} priceId - Stripe price ID for credit package
 * @param {number} credits - Number of credits to add
 * @returns {Promise<object>} Response data
 */
export const createTopUpSession = async (topupKey) => {
  try {
    const response = await fetch(`${API_URL}/stripe/create-topup-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        topupKey,
      }),
    });

    const data = await response.json();
    
    if (data.success) {
      // Redirect to Stripe Checkout
      window.location.href = data.url;
    }
    
    return data;
  } catch (error) {
    console.error('Error creating topup session:', error);
    throw error;
  }
};

/**
 * Create a Stripe Billing Portal Session
 * Opens in new tab for customer to manage subscription
 * @returns {Promise<object>} Response data
 */
export const createBillingPortalSession = async () => {
  try {
    const response = await fetch(`${API_URL}/stripe/create-billing-portal-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    const data = await response.json();
    
    if (data.success) {
      // Open billing portal in new tab
      window.open(data.url, '_blank');
    } else {
      throw new Error(data.message || 'Failed to create billing portal session');
    }
    
    return data;
  } catch (error) {
    console.error('Error creating billing portal session:', error);
    throw error;
  }
};

/**
 * Get customer's subscription information
 * @returns {Promise<object>} Subscription data
 */
export const getSubscriptionInfo = async () => {
  try {
    const response = await fetch(`${API_URL}/stripe/subscription-info`, {
      method: 'GET',
      credentials: 'include',
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error getting subscription info:', error);
    throw error;
  }
};

/**
 * Sync subscription status from Stripe
 * Useful after subscription changes outside the app
 * @returns {Promise<object>} Updated subscription data
 */
export const syncSubscriptionStatus = async () => {
  try {
    const response = await fetch(`${API_URL}/stripe/sync-subscription`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error syncing subscription:', error);
    throw error;
  }
};
