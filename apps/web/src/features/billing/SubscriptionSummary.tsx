import type { Me, WorkspacePlan } from '@pv/shared';
import { Crown, ExternalLink, Info, Zap } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { number } from '../../lib/format';
import { hasSubscription, renewalText, STATUS_LABELS, tierName } from './billingText';

/**
 * Current plan, subscription state and the two credit buckets (06): plan credits reset each
 * billing cycle; purchased credits never expire.
 */
export function SubscriptionSummary({
  plan,
  credits,
  notConnected,
  portalBusy,
  onManage,
}: {
  plan: WorkspacePlan;
  credits: Me['workspace']['credits'];
  /** The billing API isn't built yet (404): `plan` comes from `/me` instead. */
  notConnected: boolean;
  portalBusy: boolean;
  onManage: () => void;
}) {
  const renewal = renewalText(plan);
  const subscribed = hasSubscription(plan);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
      <section className="bg-white dark:bg-dark-900 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Crown className="w-5 h-5 text-amber-500" aria-hidden />
          <h2 className="text-lg font-bold text-gray-800 dark:text-white">Subscription</h2>
        </div>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-gray-600 dark:text-gray-400">Plan</dt>
            <dd className="font-semibold text-gray-800 dark:text-white">{tierName(plan.tier)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-gray-600 dark:text-gray-400">Status</dt>
            <dd>
              <Badge
                tone={
                  plan.status === 'active' ? 'green' : plan.status === 'past_due' ? 'red' : 'gray'
                }
              >
                {STATUS_LABELS[plan.status]}
              </Badge>
            </dd>
          </div>
          {renewal && (
            <div className="flex justify-between gap-3">
              <dt className="text-gray-600 dark:text-gray-400">Billing</dt>
              <dd className="text-gray-800 dark:text-white">{renewal}</dd>
            </div>
          )}
        </dl>
        {plan.status === 'past_due' && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">
            Your last payment failed. Update your card in the portal to keep your plan.
          </p>
        )}
        {notConnected && (
          <p className="mt-4 flex items-start gap-2 text-xs text-blue-700 dark:text-blue-300">
            <Info className="w-4 h-4 shrink-0" aria-hidden />
            Billing is being connected. Checkout and the billing portal open once it’s ready.
          </p>
        )}
        {subscribed && (
          <Button
            className="mt-5 w-full"
            variant="outline"
            icon={<ExternalLink className="w-4 h-4" />}
            loading={portalBusy}
            onClick={onManage}
          >
            Manage subscription
          </Button>
        )}
      </section>

      <section className="bg-white dark:bg-dark-900 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-5 h-5 text-primary-500" aria-hidden />
          <h2 className="text-lg font-bold text-gray-800 dark:text-white">Credits</h2>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          {(
            [
              ['Plan', credits.plan],
              ['Purchased', credits.purchased],
              ['Total', credits.total],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="bg-gray-100 dark:bg-dark-800 rounded-xl p-3">
              <p className="text-xs text-gray-600 dark:text-gray-400">{label}</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-white">{number(value)}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
          Plan credits reset each billing cycle; purchased credits never expire. Runs use plan
          credits first.
        </p>
      </section>
    </div>
  );
}
