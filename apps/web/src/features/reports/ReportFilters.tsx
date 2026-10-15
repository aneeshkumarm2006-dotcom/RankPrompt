import { CHECK_STATUSES, type CheckStatus, type Platform } from '@pv/shared';
import { useId } from 'react';
import { checkStatusLabel } from '../../components/ui/Badge';
import { platformLabel } from '../../lib/format';
import type { ReportFilter } from './viewModel';

const selectClass =
  'w-full bg-gray-100 dark:bg-dark-800 text-gray-800 dark:text-gray-200 rounded-lg px-3 py-2 border border-gray-300 dark:border-dark-600 focus:border-primary-500 focus:outline-none text-sm';
const labelClass = 'block text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 mb-2';

/** Drops a key when the value is "all", so the filter never holds `undefined` (exactOptional). */
function setKey<K extends keyof ReportFilter>(
  filter: ReportFilter,
  key: K,
  value: ReportFilter[K] | undefined,
): ReportFilter {
  const next = { ...filter };
  if (value === undefined) delete next[key];
  else next[key] = value;
  return next;
}

/** v1 report filters; the owner view sends them to the server, shares filter locally. */
export function ReportFilters({
  filter,
  onChange,
  platforms,
  categories,
}: {
  filter: ReportFilter;
  onChange: (filter: ReportFilter) => void;
  platforms: Platform[];
  categories: string[];
}) {
  const id = useId();
  const mentioned = filter.mentioned === undefined ? '' : filter.mentioned ? 'yes' : 'no';
  return (
    <div className="bg-white dark:bg-dark-900 rounded-2xl p-4 sm:p-6 border border-gray-200 dark:border-dark-700">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div>
          <label htmlFor={`${id}-platform`} className={labelClass}>
            Platform
          </label>
          <select
            id={`${id}-platform`}
            className={selectClass}
            value={filter.platform ?? ''}
            onChange={(e) =>
              onChange(
                setKey(filter, 'platform', (e.target.value || undefined) as Platform | undefined),
              )
            }
          >
            <option value="">All platforms</option>
            {platforms.map((p) => (
              <option key={p} value={p}>
                {platformLabel(p)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-category`} className={labelClass}>
            Category
          </label>
          <select
            id={`${id}-category`}
            className={selectClass}
            value={filter.category ?? ''}
            onChange={(e) => onChange(setKey(filter, 'category', e.target.value || undefined))}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-status`} className={labelClass}>
            Status
          </label>
          <select
            id={`${id}-status`}
            className={selectClass}
            value={filter.status ?? ''}
            onChange={(e) =>
              onChange(
                setKey(filter, 'status', (e.target.value || undefined) as CheckStatus | undefined),
              )
            }
          >
            <option value="">All statuses</option>
            {CHECK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {checkStatusLabel(s)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-mentioned`} className={labelClass}>
            Brand mentioned
          </label>
          <select
            id={`${id}-mentioned`}
            className={selectClass}
            value={mentioned}
            onChange={(e) =>
              onChange(
                setKey(
                  filter,
                  'mentioned',
                  e.target.value === '' ? undefined : e.target.value === 'yes',
                ),
              )
            }
          >
            <option value="">Any</option>
            <option value="yes">Mentioned</option>
            <option value="no">Not mentioned</option>
          </select>
        </div>
      </div>
    </div>
  );
}
