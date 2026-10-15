import type { CompetitorInsights } from '@pv/shared';
import { useState } from 'react';
import { CheckStatusBadge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/PageHeader';
import { PlatformLabel } from '../../components/ui/PlatformIcon';
import { rank } from '../../lib/format';
import { CategorySelect } from './FilterSelects';
import { orderedPlatforms } from './range';

type MatrixRow = CompetitorInsights['matrix'][number];
type MatrixCell = MatrixRow['cells'][number];

function CellContent({ cell, names }: { cell: MatrixCell; names: Map<string, string> }) {
  if (cell.status !== 'ok') return <CheckStatusBadge status={cell.status} />;
  return (
    <ul className="space-y-0.5 text-xs">
      <li className="flex justify-between gap-3 font-semibold text-action-700 dark:text-action-300">
        <span>You</span>
        <span>{rank(cell.brandRank)}</span>
      </li>
      {cell.competitorRanks.map((c) => (
        <li
          key={c.competitorId}
          className={`flex justify-between gap-3 ${
            c.rank === null
              ? 'text-gray-400 dark:text-gray-500'
              : 'text-gray-700 dark:text-gray-300'
          }`}
        >
          <span className="truncate max-w-[9rem]">{names.get(c.competitorId) ?? 'Competitor'}</span>
          <span>{rank(c.rank)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Per prompt and platform: the brand's AI rank next to each tracked competitor's (F-21). */
export function RankMatrix({ data }: { data: CompetitorInsights }) {
  const [category, setCategory] = useState<string | null>(null);
  const names = new Map(data.competitors.map((c) => [c.competitorId, c.name]));
  const platforms = orderedPlatforms(data.matrix.flatMap((r) => r.cells.map((c) => c.platform)));
  const categories = [...new Set(data.matrix.map((r) => r.category))];
  const rows = data.matrix.filter((r) => !category || r.category === category);

  return (
    <Card
      title="Rank by Prompt"
      actions={
        categories.length > 1 ? (
          <CategorySelect value={category} categories={categories} onChange={setCategory} />
        ) : undefined
      }
      className="mb-6"
    >
      {rows.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">No prompts in this run.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-gray-50 dark:bg-dark-900">
              <tr>
                <th
                  scope="col"
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase"
                >
                  Prompt
                </th>
                {platforms.map((p) => (
                  <th
                    key={p}
                    scope="col"
                    className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400"
                  >
                    <PlatformLabel platform={p} short />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
              {rows.map((row) => (
                <tr key={row.promptId} className="align-top">
                  <th
                    scope="row"
                    className="px-3 py-3 text-left font-normal text-gray-800 dark:text-gray-200 max-w-xs"
                  >
                    {row.promptText}
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {row.category}
                    </div>
                  </th>
                  {platforms.map((p) => {
                    const cell = row.cells.find((c) => c.platform === p);
                    return (
                      <td key={p} className="px-3 py-3">
                        {cell ? (
                          <CellContent cell={cell} names={names} />
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
