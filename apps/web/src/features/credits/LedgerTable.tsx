import { LEDGER_REASON_LABELS, type LedgerEntry } from '@pv/shared';
import { Info, Receipt } from 'lucide-react';
import { Link } from 'react-router';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ErrorState } from '../../components/ui/ErrorState';
import { Spinner } from '../../components/ui/Spinner';
import { useLedger } from '../../lib/api/billing';
import { formatDateTime, number } from '../../lib/format';

/** `+10` / `−3` (a real minus sign). */
export const signedDelta = (delta: number): string =>
  delta > 0 ? `+${number(delta)}` : delta < 0 ? `−${number(Math.abs(delta))}` : '0';

const th =
  'text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide';

function Row({ entry: e }: { entry: LedgerEntry }) {
  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-dark-800/50">
      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">
        {formatDateTime(e.createdAt)}
      </td>
      <td className="px-4 py-3 text-sm text-gray-800 dark:text-white">
        {LEDGER_REASON_LABELS[e.reason]}
        {e.runId && (
          <>
            {' · '}
            <Link
              to={`/app/runs/${e.runId}`}
              className="text-action-600 dark:text-action-400 hover:underline"
            >
              View run
            </Link>
          </>
        )}
        {e.note && <span className="block text-xs text-gray-500 dark:text-gray-400">{e.note}</span>}
      </td>
      <td className="px-4 py-3">
        <Badge tone={e.bucket === 'plan' ? 'orange' : 'green'}>
          {e.bucket === 'plan' ? 'Plan' : 'Purchased'}
        </Badge>
      </td>
      <td
        className={`px-4 py-3 text-right font-bold tabular-nums ${e.delta >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
      >
        {signedDelta(e.delta)}
      </td>
      <td className="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-300 tabular-nums">
        {number(e.balanceAfter.plan + e.balanceAfter.purchased)}
      </td>
    </tr>
  );
}

/** Every credit movement (F-28): `GET /credits/ledger`, cursor-paginated. */
export function LedgerTable() {
  const ledger = useLedger();
  const entries = ledger.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <section className="bg-white dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-2xl overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-gray-200 dark:border-dark-700 flex items-center gap-2">
        <Receipt className="w-5 h-5 text-primary-500" aria-hidden />
        <h2 className="text-lg font-bold text-gray-800 dark:text-white">Credit activity</h2>
      </div>

      {ledger.isPending ? (
        <div className="p-8">
          <Spinner />
        </div>
      ) : ledger.isError ? (
        <div className="p-4">
          <ErrorState error={ledger.error} onRetry={() => void ledger.refetch()} />
        </div>
      ) : entries.length === 0 ? (
        <div className="p-8 text-center">
          <Info className="w-6 h-6 mx-auto mb-2 text-gray-400" aria-hidden />
          <p className="text-gray-600 dark:text-gray-400 text-sm">No activity yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-dark-800">
              <tr>
                <th className={th}>Date</th>
                <th className={th}>Activity</th>
                <th className={th}>Bucket</th>
                <th className={`${th} text-right`}>Change</th>
                <th className={`${th} text-right`}>Balance after</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
              {entries.map((e) => (
                <Row key={e.id} entry={e} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {ledger.hasNextPage && (
        <div className="p-4 flex justify-center border-t border-gray-200 dark:border-dark-700">
          <Button
            variant="outline"
            size="sm"
            loading={ledger.isFetchingNextPage}
            onClick={() => void ledger.fetchNextPage()}
          >
            Load more
          </Button>
        </div>
      )}
    </section>
  );
}
