import type { BrandListItem } from '@pv/shared';
import {
  Archive,
  ArrowRight,
  Calendar,
  ExternalLink,
  FileText,
  Settings,
  Timer,
} from 'lucide-react';
import { Link } from 'react-router';
import { RunStatusBadge } from '../../components/ui/Badge';
import { BrandAvatar } from '../../components/ui/BrandAvatar';
import { buttonClass } from '../../components/ui/Button';
import { formatDate, pluralize, prettyUrl, ratioPct, timeAgo } from '../../lib/format';
import { needsSetup, setupHref } from './brandList';

/** One brand in the v1 MyBrands grid. Every number comes from `GET /brands`. */
export function BrandCard({
  brand,
  onArchive,
}: {
  brand: BrandListItem;
  onArchive: (brand: BrandListItem) => void;
}) {
  const setup = needsSetup(brand);
  const run = brand.latestRun;
  const dashboard = `/app/brands/${brand.id}`;

  return (
    <article className="flex flex-col bg-white dark:bg-dark-900 rounded-2xl p-6 border border-gray-200 dark:border-dark-700 hover:border-gray-300 dark:hover:border-dark-600 transition-all">
      <div className="flex items-start gap-3 mb-4">
        <BrandAvatar name={brand.name} domain={brand.domain} size="lg" />
        <div className="flex-1 min-w-0">
          <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-1 truncate">
            <Link to={dashboard} className="hover:underline">
              {brand.name}
            </Link>
          </h3>
          <a
            href={brand.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 flex items-center gap-1 truncate"
          >
            <ExternalLink className="w-3 h-3 shrink-0" aria-hidden />
            <span className="truncate">{prettyUrl(brand.websiteUrl)}</span>
          </a>
        </div>
      </div>

      <dl className="space-y-2.5 mb-5 text-sm flex-1">
        <div className="flex items-center justify-between">
          <dt className="text-gray-600 dark:text-gray-400">Visibility</dt>
          <dd
            className={
              typeof run?.visibility?.rate === 'number'
                ? 'font-semibold text-green-600 dark:text-green-400'
                : 'text-gray-400'
            }
          >
            {ratioPct(run?.visibility)}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-gray-600 dark:text-gray-400">Latest run</dt>
          <dd className="flex items-center gap-2">
            {run ? (
              <>
                <RunStatusBadge status={run.status} />
                <Link
                  to={`/app/runs/${run.id}`}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:underline"
                >
                  {timeAgo(run.createdAt)}
                </Link>
              </>
            ) : (
              <span className="text-gray-400">No runs yet</span>
            )}
          </dd>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400 pt-1">
          <span className="inline-flex items-center gap-1">
            <FileText className="w-3 h-3" aria-hidden />
            {pluralize(brand.promptCount, 'prompt')}
          </span>
          <span className="inline-flex items-center gap-1">
            <Timer className="w-3 h-3" aria-hidden />
            {pluralize(brand.activeSchedules, 'active schedule')}
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
          <Calendar className="w-3 h-3" aria-hidden />
          Created {formatDate(brand.createdAt)}
        </div>
      </dl>

      <div className="flex gap-2">
        {setup ? (
          <Link to={setupHref(brand.id)} className={`${buttonClass('primary', 'sm')} flex-1`}>
            Continue setup <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
        ) : (
          <Link to={dashboard} className={`${buttonClass('primary', 'sm')} flex-1`}>
            View dashboard
          </Link>
        )}
        <Link
          to={`/app/brands/${brand.id}/settings`}
          className={buttonClass('secondary', 'sm')}
          aria-label={`Settings for ${brand.name}`}
          title="Brand settings"
        >
          <Settings className="w-4 h-4" aria-hidden />
        </Link>
        <button
          type="button"
          onClick={() => onArchive(brand)}
          className="px-3 py-1.5 bg-red-500/10 text-red-500 dark:text-red-400 rounded-lg hover:bg-red-500/20 transition-colors"
          aria-label={`Archive ${brand.name}`}
          title="Archive brand"
        >
          <Archive className="w-4 h-4" aria-hidden />
        </button>
      </div>
    </article>
  );
}
