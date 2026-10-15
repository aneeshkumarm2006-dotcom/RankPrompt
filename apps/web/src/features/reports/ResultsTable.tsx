import type { Platform } from '@pv/shared';
import { CheckCircle2, Link2, XCircle } from 'lucide-react';
import { CheckStatusBadge, checkStatusLabel } from '../../components/ui/Badge';
import { PlatformLabel, PLATFORM_SHORT } from '../../components/ui/PlatformIcon';
import { rank } from '../../lib/format';
import { groupByPrompt, type ReportCheck } from './viewModel';

/** Screen-reader text for one cell. */
function cellLabel(check: ReportCheck): string {
  const where = `${PLATFORM_SHORT[check.platform]}: `;
  if (check.status !== 'ok') return `${where}${checkStatusLabel(check.status)}. Open details`;
  const parts = [
    check.mentioned ? 'mentioned' : 'not mentioned',
    check.rank !== null ? `rank ${check.rank}` : 'no rank',
    check.cited ? 'cited' : 'not cited',
  ];
  return `${where}${parts.join(', ')}. Open the answer`;
}

function CellContent({ check }: { check: ReportCheck }) {
  if (check.status !== 'ok') return <CheckStatusBadge status={check.status} />;
  return (
    <span className="inline-flex items-center gap-2">
      {check.mentioned ? (
        <CheckCircle2 className="w-4 h-4 text-green-500" aria-hidden />
      ) : (
        <XCircle className="w-4 h-4 text-red-500" aria-hidden />
      )}
      <span className="text-sm font-medium text-gray-800 dark:text-gray-200 min-w-[2ch]">
        {rank(check.rank)}
      </span>
      {check.cited && <Link2 className="w-4 h-4 text-blue-500" aria-hidden />}
    </span>
  );
}

/** Prompt rows × platform columns (09 § ReportView). Each cell opens the full answer. */
export function ResultsTable({
  checks,
  platforms,
  onOpen,
}: {
  checks: ReportCheck[];
  platforms: Platform[];
  onOpen: (check: ReportCheck) => void;
}) {
  const rows = groupByPrompt(checks);
  return (
    <div className="bg-white dark:bg-dark-900 rounded-2xl border border-gray-200 dark:border-dark-700">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead className="bg-gray-50 dark:bg-dark-800">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Prompt
              </th>
              {platforms.map((p) => (
                <th
                  key={p}
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap"
                >
                  <PlatformLabel platform={p} short />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
            {rows.map((row) => (
              <tr key={row.promptKey} className="align-top">
                <td className="px-3 py-3 text-sm text-gray-800 dark:text-gray-200 max-w-md">
                  <div className="break-words">{row.prompt}</div>
                  <span className="mt-1 inline-block px-2 py-0.5 bg-gray-200 dark:bg-dark-700 rounded-full text-xs text-gray-600 dark:text-gray-400">
                    {row.category}
                  </span>
                </td>
                {platforms.map((p) => {
                  const check = row.cells[p];
                  return (
                    <td key={p} className="px-2 py-2 whitespace-nowrap">
                      {check ? (
                        <button
                          type="button"
                          onClick={() => onOpen(check)}
                          aria-label={cellLabel(check)}
                          className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-action-500 transition-colors"
                        >
                          <CellContent check={check} />
                        </button>
                      ) : (
                        <span className="px-2 text-gray-400">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && (
        <div className="text-center py-12 text-gray-600 dark:text-gray-400">No results found</div>
      )}
      <div className="flex flex-wrap gap-4 px-4 py-3 border-t border-gray-200 dark:border-dark-700 text-xs text-gray-500 dark:text-gray-400">
        <span className="inline-flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-green-500" aria-hidden /> Mentioned
        </span>
        <span className="inline-flex items-center gap-1">
          <XCircle className="w-3.5 h-3.5 text-red-500" aria-hidden /> Not mentioned
        </span>
        <span>#n Rank in the answer&apos;s company list</span>
        <span className="inline-flex items-center gap-1">
          <Link2 className="w-3.5 h-3.5 text-blue-500" aria-hidden /> Your site is cited
        </span>
      </div>
    </div>
  );
}
