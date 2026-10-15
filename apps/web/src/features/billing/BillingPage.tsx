import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router';
import { ErrorState } from '../../components/ui/ErrorState';
import { PageSpinner } from '../../components/ui/Spinner';
import { useMe } from '../../lib/api/auth';
import { useBillingPortal, useCheckout, useSubscription, useTopup } from '../../lib/api/billing';
import { usePlans } from '../../lib/api/meta';
import { isNotFound } from '../../lib/errors';
import { billingErrorMessage, hasSubscription, RETURN_PARAMS, returnNotice } from './billingText';
import { PlanCards } from './PlanCards';
import { SubscriptionSummary } from './SubscriptionSummary';
import { TopupPacks } from './TopupPacks';

const onBillingError = (err: unknown) => toast.error(billingErrorMessage(err));

/** `/app/billing`: plans, top-ups, subscription and portal (F-29, F-30; v1 BuyCredits). */
export function BillingPage() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const me = useMe();
  const plans = usePlans();
  const subscription = useSubscription();
  const checkout = useCheckout();
  const topup = useTopup();
  const portal = useBillingPortal();

  // Back from Stripe: tell the user, refresh credits, then clean the URL.
  useEffect(() => {
    const notice = returnNotice(params);
    if (!notice) return;
    if (notice.kind === 'success') {
      toast.success(notice.message, { id: 'billing-return' });
      void qc.invalidateQueries({ queryKey: ['me'] });
      void qc.invalidateQueries({ queryKey: ['billing'] });
      void qc.invalidateQueries({ queryKey: ['credits'] });
    } else {
      toast(notice.message, { id: 'billing-return' });
    }
    const next = new URLSearchParams(params);
    for (const key of RETURN_PARAMS) next.delete(key);
    setParams(next, { replace: true });
  }, [params, qc, setParams]);

  if (me.isPending || plans.isPending) return <PageSpinner />;
  if (plans.isError) return <ErrorState error={plans.error} onRetry={() => void plans.refetch()} />;
  if (!me.data) return <ErrorState error={me.error} onRetry={() => void me.refetch()} />;

  const notConnected = subscription.isError && isNotFound(subscription.error);
  const plan = subscription.data ?? me.data.workspace.plan;
  const subscribed = hasSubscription(plan);
  const manage = () => portal.mutate(undefined, { onError: onBillingError });

  return (
    <div className="max-w-7xl mx-auto">
      <header className="mb-10 text-center">
        <h1 className="text-4xl sm:text-5xl font-black text-gray-900 dark:text-white tracking-tight">
          Plans &amp; Pricing
        </h1>
        <p className="mt-3 text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Find the right plan to grow your AI visibility. Upgrade, downgrade or cancel anytime.
        </p>
      </header>

      <SubscriptionSummary
        plan={plan}
        credits={me.data.workspace.credits}
        notConnected={notConnected}
        portalBusy={portal.isPending}
        onManage={manage}
      />
      {subscription.isError && !notConnected && (
        <p role="alert" className="-mt-8 mb-8 text-sm text-red-600 dark:text-red-400">
          Could not load your subscription details. Showing your plan from your account instead.
        </p>
      )}

      <PlanCards
        plans={plans.data.plans}
        currentTier={plan.tier}
        subscribed={subscribed}
        busyTier={checkout.isPending ? checkout.variables : null}
        portalBusy={portal.isPending}
        onSubscribe={(tier) => checkout.mutate(tier, { onError: onBillingError })}
        onManage={manage}
      />

      <TopupPacks
        topups={plans.data.topups}
        busyPack={topup.isPending ? topup.variables : null}
        onBuy={(pack) => topup.mutate(pack, { onError: onBillingError })}
      />
    </div>
  );
}
