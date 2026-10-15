import { AlertTriangle, Calendar, Globe, Languages } from 'lucide-react';
import type { ReactNode } from 'react';
import { RunStatusBadge } from '../../components/ui/Badge';
import { BrandAvatar } from '../../components/ui/BrandAvatar';
import { PlatformIcon, PLATFORM_SHORT } from '../../components/ui/PlatformIcon';
import { formatDateTime, languageLabel, locationLabel } from '../../lib/format';
import type { ReportViewModel } from './viewModel';

/** A run that ended badly still shows its report, with a word about why it looks thin. */
function statusNotice(status: ReportViewModel['status'], readOnly: boolean): string | null {
  const refunded = readOnly ? '' : ' and were refunded';
  switch (status) {
    case 'failed':
      return `This run failed: none of its checks got an answer${readOnly ? '' : ', and they were all refunded'}.`;
    case 'canceled':
      return `This run was canceled. Checks that had not run yet were skipped${refunded}; the results cover the checks that finished.`;
    case 'partial':
      return `Some checks in this run failed${refunded}. The metrics count only the answered checks.`;
    default:
      return null;
  }
}

/** v1 report header: brand, date, location, platforms and status, with the owner's actions. */
export function ReportHeader({
  report,
  readOnly,
  actions,
}: {
  report: ReportViewModel;
  readOnly: boolean;
  actions?: ReactNode;
}) {
  const notice = statusNotice(report.status, readOnly);
  return (
    <div className="bg-white dark:bg-dark-900 rounded-2xl p-4 sm:p-6 border border-gray-200 dark:border-dark-700">
      <div className="flex flex-col lg:flex-row justify-between items-start gap-4">
        <div className="flex items-start gap-4 min-w-0">
          <BrandAvatar name={report.brand.name} domain={report.brand.domain} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white break-words">
                {report.brand.name} - Visibility Analysis
              </h1>
              <RunStatusBadge status={report.status} />
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 break-all">
              {report.brand.domain}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500 dark:text-gray-400">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="w-4 h-4" aria-hidden />
                {formatDateTime(report.date)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Globe className="w-4 h-4" aria-hidden />
                {locationLabel(report.country, report.city)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Languages className="w-4 h-4" aria-hidden />
                {languageLabel(report.language)}
              </span>
              <span className="inline-flex flex-wrap items-center gap-2">
                {report.platforms.map((p) => (
                  <span
                    key={p}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-dark-800 text-xs text-gray-700 dark:text-gray-300"
                  >
                    <PlatformIcon platform={p} size={14} />
                    {PLATFORM_SHORT[p]}
                  </span>
                ))}
              </span>
            </div>
          </div>
        </div>
        {!readOnly && actions && (
          <div className="flex flex-wrap gap-2 w-full lg:w-auto lg:justify-end">{actions}</div>
        )}
      </div>
      {notice && (
        <div
          role="status"
          className="mt-4 flex items-start gap-2 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/50 px-4 py-3 text-sm text-yellow-800 dark:text-yellow-300"
        >
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
          <span>{notice}</span>
        </div>
      )}
    </div>
  );
}
