import type { PromptHistoryResponse } from '@pv/shared';
import { Check, Link2, X } from 'lucide-react';
import { Link } from 'react-router';
import { Badge, checkStatusLabel } from '../../components/ui/Badge';
import { PlatformLabel } from '../../components/ui/PlatformIcon';
import { formatDate, rank } from '../../lib/format';
import { orderedPlatforms } from '../insights/range';

export type HistoryEntry = PromptHistoryResponse['prompts'][number]['history'][number];
type CheckOutcome = NonNullable<HistoryEntry['perPlatform'][keyof HistoryEntry['perPlatform']]>;

function CheckCell({ check }: { check: CheckOutcome | undefined }) {
  if (!check) return <span className="text-gray-400">—</span>;
  if (check.status !== 'ok') {
    return (
      <span className="text-xs text-gray-500 dark:text-gray-400">
        {checkStatusLabel(check.status)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 text-xs">
      {check.mentioned ? (
        <span className="inline-flex items-center gap-0.5 text-green-600 dark:text-green-400">
          <Check className="w-4 h-4" aria-hidden />
          <span className="sr-only">Mentioned</span>
        </span>
      ) : (
        <span className="inline-flex items-center gap-0.5 text-red-500">
          <X className="w-4 h-4" aria-hidden />
          <span className="sr-only">Not mentioned</span>
        </span>
      )}
      <span className="font-medium text-gray-800 dark:text-gray-200" title="AI rank">
        {rank(check.rank)}
      </span>
      {check.cited && (
        <span className="text-action-600 dark:text-action-400" title="Your site was cited">
          <Link2 className="w-3.5 h-3.5" aria-hidden />
          <span className="sr-only">Cited</span>
        </span>
      )}
    </span>
  );
}

/**
 * One prompt's results across runs (F-22): the real manual/scheduled trigger and, per platform,
 * mentioned ✓/✗, the AI's rank (not a row number) and whether the brand's site was cited.
 */
export function PromptHistory({ history }: { history: HistoryEntry[] }) {
  if (history.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Not in any finished report in the last 90 days.
      </p>
    );
  }
  const platforms = orderedPlatforms(history.flatMap((h) => Object.keys(h.perPlatform)));
  const newestFirst = [...history].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-500 dark:text-gray-400">
            <th scope="col" className="px-3 py-2 text-left font-medium uppercase">
              Report
            </th>
            <th scope="col" className="px-3 py-2 text-left font-medium uppercase">
              Type
            </th>
            {platforms.map((p) => (
              <th key={p} scope="col" className="px-3 py-2 text-left font-medium">
                <PlatformLabel platform={p} short />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
          {newestFirst.map((h) => (
            <tr key={h.runId}>
              <td className="px-3 py-2 whitespace-nowrap">
                <Link
                  to={`/app/runs/${h.runId}`}
                  className="text-action-600 hover:text-action-700 dark:text-action-400 font-medium"
                >
                  {formatDate(h.date)}
                </Link>
              </td>
              <td className="px-3 py-2">
                <Badge tone={h.trigger === 'scheduled' ? 'blue' : 'gray'}>
                  {h.trigger === 'scheduled' ? 'Scheduled' : 'Manual'}
                </Badge>
              </td>
              {platforms.map((p) => (
                <td key={p} className="px-3 py-2">
                  <CheckCell check={h.perPlatform[p]} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
