import type { RunEstimate } from '@pv/shared';
import { AlertCircle, Loader2, Zap } from 'lucide-react';
import { number, pluralize } from '../../lib/format';

/** "N checks × 1 credit" summary from `POST /runs/estimate` (never computed in the browser). */
export function EstimateBanner({
  estimate,
  loading,
  promptCount,
  platformCount,
}: {
  estimate: RunEstimate | undefined;
  loading: boolean;
  promptCount: number;
  platformCount: number;
}) {
  if (promptCount === 0 || platformCount === 0) {
    return (
      <div className="rounded-xl p-4 bg-gray-50 dark:bg-dark-800 text-sm text-gray-500 dark:text-gray-400">
        Pick at least one prompt and one platform to see the cost.
      </div>
    );
  }
  if (loading || !estimate) {
    return (
      <div className="rounded-xl p-4 bg-gray-50 dark:bg-dark-800 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Calculating cost…
      </div>
    );
  }
  const balance = estimate.balance.plan + estimate.balance.purchased;
  return (
    <div
      data-testid="run-estimate"
      className={`rounded-xl p-4 border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
        estimate.sufficient
          ? 'bg-action-50 dark:bg-action-900/20 border-action-200 dark:border-action-800'
          : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/50'
      }`}
    >
      <div className="flex items-center gap-3">
        {estimate.sufficient ? (
          <Zap className="w-5 h-5 text-action-600 dark:text-action-400 shrink-0" />
        ) : (
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
        )}
        <div>
          <p className="font-semibold text-gray-800 dark:text-white">
            {pluralize(estimate.credits, 'credit')}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {pluralize(promptCount, 'prompt')} × {pluralize(platformCount, 'platform')} ={' '}
            {pluralize(estimate.checks, 'check')}. Failed checks are refunded.
          </p>
        </div>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300">
        Balance: <span className="font-semibold">{number(balance)}</span>
        {!estimate.sufficient && <span className="text-red-500 font-semibold"> (not enough)</span>}
      </p>
    </div>
  );
}
