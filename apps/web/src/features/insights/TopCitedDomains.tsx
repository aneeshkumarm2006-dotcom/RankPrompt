import { Link } from 'react-router';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/PageHeader';
import { PlatformIcon } from '../../components/ui/PlatformIcon';
import { faviconUrl, number } from '../../lib/format';
import type { Aggregates } from './PlatformScores';

/** The latest run's most cited domains, the brand's own site highlighted (F-19). */
export function TopCitedDomains({
  brandId,
  domains,
  limit = 10,
}: {
  brandId: string;
  domains: Aggregates['topCitedDomains'];
  limit?: number;
}) {
  return (
    <Card
      title="Top Cited Domains"
      actions={
        <Link
          to={`/app/brands/${brandId}/sources`}
          className="text-sm font-medium text-action-600 hover:text-action-700 dark:text-action-400"
        >
          View all sources →
        </Link>
      }
    >
      {domains.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">No citations in the latest run.</p>
      ) : (
        <ol className="divide-y divide-gray-200 dark:divide-dark-700">
          {domains.slice(0, limit).map((d, i) => (
            <li
              key={d.domain}
              className={`flex items-center gap-3 py-2.5 px-2 rounded-lg ${
                d.isBrand ? 'bg-action-50 dark:bg-action-900/20' : ''
              }`}
            >
              <span className="w-6 text-xs text-gray-400">#{i + 1}</span>
              <img src={faviconUrl(d.domain, 32)} alt="" aria-hidden width={16} height={16} />
              <span className="flex-1 min-w-0 truncate text-sm text-gray-800 dark:text-gray-200">
                {d.domain}
              </span>
              {d.isBrand && <Badge tone="purple">Your site</Badge>}
              <span className="hidden sm:flex items-center gap-1">
                {d.platforms.map((p) => (
                  <PlatformIcon key={p} platform={p} size={14} />
                ))}
              </span>
              <span className="text-sm font-semibold text-gray-800 dark:text-white w-10 text-right">
                {number(d.count)}
              </span>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-3 text-xs text-gray-400">Latest run, all platforms.</p>
    </Card>
  );
}
