import { PAID_TIERS, type PaidTier, type PlanTier } from '@pv/shared';
import { Check } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { money } from '../../lib/format';
import { planFeatures, type PlanInfo } from './billingText';

const POPULAR: PlanTier = 'pro';

/** v1 BuyCredits plan grid; prices and limits come from `/plans` (F-29). */
export function PlanCards({
  plans,
  currentTier,
  subscribed,
  busyTier,
  portalBusy,
  onSubscribe,
  onManage,
}: {
  plans: PlanInfo[];
  currentTier: PlanTier;
  subscribed: boolean;
  busyTier: PaidTier | null;
  portalBusy: boolean;
  onSubscribe: (tier: PaidTier) => void;
  onManage: () => void;
}) {
  const paid = plans.filter((p): p is PlanInfo & { tier: PaidTier } =>
    (PAID_TIERS as readonly string[]).includes(p.tier),
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
      {paid.map((plan) => {
        const current = plan.tier === currentTier;
        const popular = plan.tier === POPULAR;
        return (
          <div
            key={plan.tier}
            data-testid={`plan-${plan.tier}`}
            className={`relative bg-white dark:bg-dark-900 rounded-2xl p-8 flex flex-col transition-all duration-300 hover:shadow-2xl ${
              current
                ? 'border-2 border-green-500 shadow-xl'
                : popular
                  ? 'border-2 border-purple-500 shadow-xl'
                  : 'border border-gray-200 dark:border-dark-700'
            }`}
          >
            {(current || popular) && (
              <div className="absolute top-0 -translate-y-1/2 left-1/2 -translate-x-1/2">
                <span
                  className={`${current ? 'bg-green-500' : 'bg-purple-500'} text-white text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wider shadow-md whitespace-nowrap`}
                >
                  {current ? 'Your plan' : 'Most popular'}
                </span>
              </div>
            )}
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">{plan.name}</h3>
            <div className="mb-6 flex items-baseline">
              <span className="text-5xl font-extrabold text-gray-900 dark:text-white">
                {money(plan.priceCentsMonthly)}
              </span>
              <span className="ml-1 text-lg text-gray-500 dark:text-gray-400">/month</span>
            </div>

            {current ? (
              <Button variant="secondary" size="lg" disabled className="w-full">
                Current plan
              </Button>
            ) : subscribed ? (
              <Button
                variant="outline"
                size="lg"
                className="w-full"
                loading={portalBusy}
                onClick={onManage}
              >
                Manage in portal
              </Button>
            ) : (
              <Button
                variant={popular ? 'primary' : 'secondary'}
                size="lg"
                className="w-full"
                loading={busyTier === plan.tier}
                disabled={busyTier !== null}
                onClick={() => onSubscribe(plan.tier)}
              >
                Subscribe
              </Button>
            )}

            <div className="border-t border-gray-200 dark:border-dark-700 my-8" />
            <ul className="space-y-4">
              {planFeatures(plan).map((f) => (
                <li key={f} className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-500 shrink-0" aria-hidden />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{f}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
