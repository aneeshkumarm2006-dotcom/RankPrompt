import { AlertCircle, Zap } from 'lucide-react';
import { Link } from 'react-router';
import { number, pluralize } from '../../lib/format';

/**
 * v1's credits banner: the current balance against what the active schedules need for their
 * next run each (server `creditsPerRun`).
 */
export function ScheduleCreditsBanner({
  balance,
  neededPerCycle,
  activeCount,
}: {
  balance: number;
  neededPerCycle: number;
  activeCount: number;
}) {
  const enough = balance >= neededPerCycle;
  return (
    <div
      className={`rounded-xl p-4 mb-6 flex items-start gap-3 border ${
        enough
          ? 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30'
          : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30'
      }`}
    >
      {enough ? (
        <Zap className="w-5 h-5 text-green-500 shrink-0 mt-0.5" aria-hidden />
      ) : (
        <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" aria-hidden />
      )}
      <div>
        <p
          className={`font-semibold ${enough ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}
        >
          {enough ? 'Credits available' : 'Not enough credits'}
        </p>
        <p
          className={`text-sm ${enough ? 'text-green-600 dark:text-green-300' : 'text-red-600 dark:text-red-300'}`}
        >
          You have <strong>{pluralize(balance, 'credit')}</strong>.{' '}
          {activeCount > 0 ? (
            <>
              The next run of your {pluralize(activeCount, 'active schedule')} needs{' '}
              <strong>{number(neededPerCycle)}</strong> in total.
            </>
          ) : (
            'No schedule is active.'
          )}
          {!enough && (
            <>
              {' '}
              <Link to="/app/billing" className="underline hover:no-underline">
                Buy more credits
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
