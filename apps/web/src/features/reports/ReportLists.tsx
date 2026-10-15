import { Badge } from '../../components/ui/Badge';
import { PlatformIcon } from '../../components/ui/PlatformIcon';
import {
  faviconUrl,
  number,
  ratioChartValue,
  ratioFraction,
  ratioPct,
  rank,
} from '../../lib/format';
import type { ReportAggregates } from './viewModel';

const panel =
  'bg-white dark:bg-dark-900 rounded-2xl p-4 sm:p-6 border border-gray-200 dark:border-dark-700';
const heading = 'text-lg sm:text-xl font-bold text-gray-800 dark:text-white mb-4';
const empty = 'text-sm text-gray-500 dark:text-gray-400';

/** Brand vs tracked competitors, each bar a server share-of-voice ratio. */
export function ShareOfVoice({
  aggregates,
  brandName,
}: {
  aggregates: ReportAggregates | null;
  brandName: string;
}) {
  const rows = aggregates
    ? [
        { name: brandName, ratio: aggregates.total.shareOfVoice, isBrand: true },
        ...aggregates.competitors.map((c) => ({
          name: c.name,
          ratio: c.shareOfVoice,
          isBrand: false,
        })),
      ]
    : [];
  return (
    <section className={panel}>
      <h2 className={heading}>Competitor share of voice</h2>
      {rows.length <= 1 ? (
        <p className={empty}>Add competitors to the brand to compare share of voice.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={`${row.isBrand ? 'b' : 'c'}-${row.name}`}>
              <div className="flex items-center justify-between gap-3 text-sm mb-1">
                <span
                  className={`truncate ${row.isBrand ? 'font-semibold text-action-600 dark:text-action-400' : 'text-gray-700 dark:text-gray-300'}`}
                >
                  {row.name}
                  {row.isBrand && ' (you)'}
                </span>
                <span className="shrink-0 text-gray-800 dark:text-white font-medium">
                  {ratioPct(row.ratio)}{' '}
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {ratioFraction(row.ratio)}
                  </span>
                </span>
              </div>
              <div className="h-2 rounded-full bg-gray-200 dark:bg-dark-700 overflow-hidden">
                <div
                  className={`h-full rounded-full ${row.isBrand ? 'bg-action-500' : 'bg-gray-400 dark:bg-gray-500'}`}
                  style={{ width: `${ratioChartValue(row.ratio)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function TopCitedDomains({ aggregates }: { aggregates: ReportAggregates | null }) {
  const domains = aggregates?.topCitedDomains ?? [];
  return (
    <section className={panel}>
      <h2 className={heading}>Top cited domains</h2>
      {domains.length === 0 ? (
        <p className={empty}>No citations in this run.</p>
      ) : (
        <ol className="divide-y divide-gray-100 dark:divide-dark-700">
          {domains.map((d) => (
            <li key={d.domain} className="flex items-center gap-3 py-2">
              <img
                src={faviconUrl(d.domain, 32)}
                alt=""
                aria-hidden
                width={16}
                height={16}
                className="shrink-0 rounded-sm"
                loading="lazy"
              />
              <span className="flex-1 min-w-0 truncate text-sm text-gray-800 dark:text-gray-200">
                {d.domain}
              </span>
              {d.isBrand && <Badge tone="green">Your site</Badge>}
              <span className="hidden sm:inline-flex gap-1">
                {d.platforms.map((p) => (
                  <PlatformIcon key={p} platform={p} size={14} />
                ))}
              </span>
              <span className="w-10 text-right text-sm font-semibold text-gray-800 dark:text-white">
                {number(d.count)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function SuggestedCompetitors({ aggregates }: { aggregates: ReportAggregates | null }) {
  const rows = aggregates?.suggestedCompetitors ?? [];
  return (
    <section className={panel}>
      <h2 className={heading}>Suggested competitors</h2>
      {rows.length === 0 ? (
        <p className={empty}>No other companies came up in the answers.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
              <th className="pb-2 font-medium">Company</th>
              <th className="pb-2 font-medium text-right">Mentions</th>
              <th className="pb-2 font-medium text-right">Best</th>
              <th className="pb-2 font-medium text-right">Avg rank</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
            {rows.map((s) => (
              <tr key={s.name}>
                <td className="py-2 pr-2 text-gray-800 dark:text-gray-200">{s.name}</td>
                <td className="py-2 text-right text-gray-800 dark:text-white">
                  {number(s.mentions)}
                </td>
                <td className="py-2 text-right text-gray-600 dark:text-gray-300">
                  {rank(s.bestRank)}
                </td>
                <td className="py-2 text-right text-gray-600 dark:text-gray-300">
                  {rank(s.avgRank)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
