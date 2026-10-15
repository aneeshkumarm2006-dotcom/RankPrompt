import type Stripe from 'stripe';
import { createStripeClient } from './gateway';
import type { PriceBook } from './prices';

/**
 * The Customer Portal settings 06 asks for: switch between our plan prices (upgrades at once with
 * a prorated invoice, so `invoice.paid` tops the plan credits up; downgrades at period end),
 * cancel at period end, update the card, see invoices. Created once per Stripe mode with
 * `pnpm admin stripe-portal --yes`; the printed `bpc_…` id goes in `STRIPE_PORTAL_CONFIGURATION_ID`.
 */
export async function portalConfigParams(
  stripe: Stripe,
  prices: PriceBook,
  appUrl: string,
): Promise<Stripe.BillingPortal.ConfigurationCreateParams> {
  const tierPrices = prices.tierPrices();
  if (tierPrices.length === 0) throw new Error('no STRIPE_PRICE_STARTER/_PRO/_AGENCY set');
  const byProduct = new Map<string, string[]>();
  for (const { priceId } of tierPrices) {
    const price = await stripe.prices.retrieve(priceId);
    const product = typeof price.product === 'string' ? price.product : price.product.id;
    byProduct.set(product, [...(byProduct.get(product) ?? []), priceId]);
  }
  return {
    business_profile: { headline: 'PromptVerse: manage your plan and billing' },
    default_return_url: `${appUrl}/app/billing`,
    features: {
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: { enabled: true, mode: 'at_period_end', proration_behavior: 'none' },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ['price'],
        proration_behavior: 'always_invoice',
        products: [...byProduct].map(([product, ids]) => ({ product, prices: ids })),
        schedule_at_period_end: { conditions: [{ type: 'decreasing_item_amount' }] },
      },
    },
  };
}

export async function createPortalConfiguration(opts: {
  secretKey: string;
  prices: PriceBook;
  appUrl: string;
  create: boolean;
}): Promise<{ params: Stripe.BillingPortal.ConfigurationCreateParams; id: string | null }> {
  const stripe = createStripeClient(opts.secretKey);
  const params = await portalConfigParams(stripe, opts.prices, opts.appUrl);
  if (!opts.create) return { params, id: null };
  const config = await stripe.billingPortal.configurations.create(params);
  return { params, id: config.id };
}
