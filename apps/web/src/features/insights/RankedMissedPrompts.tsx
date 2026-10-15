import type { Platform } from '@pv/shared';
import { CheckCircle, Link2, XCircle } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router';
import { Card } from '../../components/ui/PageHeader';
import { PLATFORM_SHORT } from '../../components/ui/PlatformIcon';
import { Spinner } from '../../components/ui/Spinner';
import { ErrorState } from '../../components/ui/ErrorState';
import { usePromptHistory } from '../../lib/api/insights';
import { rank } from '../../lib/format';
import { splitRankedMissed, type PromptOutcome } from './rankedMissed';

const SHOWN = 10;

function OutcomeTable({ rows, kind }: { rows: PromptOutcome[]; kind: 'ranked' | 'missed' }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400 py-4">
        {kind === 'ranked' ? 'No prompts mention your brand' : 'No missed prompts'} for these
        filters.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-dark-900">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              Prompt
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              Category
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              AI rank per platform
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
          {rows.slice(0, SHOWN).map((row) => (
            <tr key={row.promptId} className="hover:bg-gray-50 dark:hover:bg-dark-900">
              <td className="px-4 py-3 text-gray-800 dark:text-gray-200 max-w-md">{row.text}</td>
              <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                {row.category}
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {row.cells.map((c) => (
                    <span
                      key={c.platform}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${
                        c.mentioned
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}
                    >
                      {PLATFORM_SHORT[c.platform]}{' '}
                      {c.mentioned ? (c.rank === null ? 'mentioned' : rank(c.rank)) : 'miss'}
                      {c.cited && <Link2 className="w-3 h-3" aria-label="cited" />}
                    </span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > SHOWN && (
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Showing {SHOWN} of {rows.length}.
        </p>
      )}
    </div>
  );
}

/** Ranked vs missed prompts of the latest run (F-19); category and platform filters apply. */
export function RankedMissedPrompts({
  brandId,
  runId,
  runCreatedAt,
  platform,
  category,
}: {
  brandId: string;
  runId: string;
  runCreatedAt: string;
  platform: Platform | null;
  category: string | null;
}) {
  // From the latest run's creation on, so the history covers it however old it is.
  const history = usePromptHistory(brandId, { from: runCreatedAt });
  const split = useMemo(
    () => splitRankedMissed(history.data?.prompts ?? [], runId, { platform, category }),
    [history.data, runId, platform, category],
  );

  return (
    <Card
      title="Ranked & Missed Prompts"
      actions={
        <Link
          to={`/app/runs/${runId}`}
          className="text-sm font-medium text-action-600 hover:text-action-700 dark:text-action-400"
        >
          Open report →
        </Link>
      }
      className="mb-6"
    >
      {history.isPending ? (
        <Spinner size="sm" />
      ) : history.isError ? (
        <ErrorState error={history.error} onRetry={() => void history.refetch()} />
      ) : (
        <div className="space-y-8">
          <section>
            <h3 className="text-base font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" aria-hidden />
              Ranked Prompts ({split.ranked.length})
            </h3>
            <OutcomeTable rows={split.ranked} kind="ranked" />
          </section>
          <section>
            <h3 className="text-base font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-500" aria-hidden />
              Missed Prompts ({split.missed.length})
            </h3>
            <OutcomeTable rows={split.missed} kind="missed" />
          </section>
        </div>
      )}
    </Card>
  );
}
