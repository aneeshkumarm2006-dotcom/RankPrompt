import { RUN_STATUSES, RUN_TRIGGERS, type RunStatus, type RunTrigger } from '@pv/shared';
import { useId } from 'react';
import { runStatusLabel } from '../../components/ui/Badge';
import { useBrands } from '../../lib/api/brands';
import type { RunsFilter } from '../../lib/api/queryKeys';

const selectClass =
  'w-full bg-gray-100 dark:bg-dark-800 text-gray-800 dark:text-gray-200 rounded-lg px-3 py-2 border border-gray-300 dark:border-dark-600 focus:border-primary-500 focus:outline-none text-sm';
const labelClass = 'block text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 mb-2';

const TRIGGER_LABELS: Record<RunTrigger, string> = { manual: 'Manual', scheduled: 'Scheduled' };
export const triggerLabel = (t: RunTrigger): string => TRIGGER_LABELS[t];

function withKey<K extends keyof RunsFilter>(
  filter: RunsFilter,
  key: K,
  value: RunsFilter[K] | undefined,
): RunsFilter {
  const next = { ...filter };
  if (value === undefined) delete next[key];
  else next[key] = value;
  return next;
}

function BrandSelect({
  id,
  filter,
  onChange,
}: {
  id: string;
  filter: RunsFilter;
  onChange: (f: RunsFilter) => void;
}) {
  const brands = useBrands();
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        Brand
      </label>
      <select
        id={id}
        className={selectClass}
        value={filter.brandId ?? ''}
        onChange={(e) => onChange(withKey(filter, 'brandId', e.target.value || undefined))}
      >
        <option value="">All brands</option>
        {(brands.data ?? []).map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Status / trigger (and brand, on the all-runs page) filters, passed to `GET /runs`. */
export function RunFilters({
  filter,
  onChange,
  showBrand = false,
}: {
  filter: RunsFilter;
  onChange: (filter: RunsFilter) => void;
  showBrand?: boolean;
}) {
  const id = useId();
  return (
    <div className="bg-white dark:bg-dark-900 rounded-2xl p-4 sm:p-6 mb-6 border border-gray-200 dark:border-dark-700">
      <div
        className={`grid grid-cols-1 gap-3 sm:gap-4 ${showBrand ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}
      >
        {showBrand && <BrandSelect id={`${id}-brand`} filter={filter} onChange={onChange} />}
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
                withKey(filter, 'status', (e.target.value || undefined) as RunStatus | undefined),
              )
            }
          >
            <option value="">All statuses</option>
            {RUN_STATUSES.map((s) => (
              <option key={s} value={s}>
                {runStatusLabel(s)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-trigger`} className={labelClass}>
            Run type
          </label>
          <select
            id={`${id}-trigger`}
            className={selectClass}
            value={filter.trigger ?? ''}
            onChange={(e) =>
              onChange(
                withKey(filter, 'trigger', (e.target.value || undefined) as RunTrigger | undefined),
              )
            }
          >
            <option value="">Manual and scheduled</option>
            {RUN_TRIGGERS.map((t) => (
              <option key={t} value={t}>
                {triggerLabel(t)}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
