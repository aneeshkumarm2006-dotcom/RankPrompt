import type { Platform } from '@pv/shared';
import { useId, type ReactNode } from 'react';
import { PLATFORM_SHORT } from '../../components/ui/PlatformIcon';
import { isPlatform, isRangeDays, RANGE_OPTIONS, type RangeDays } from './range';

/** v1 filter-bar select look. */
export const filterSelectClass =
  'w-full sm:w-auto px-4 py-2 bg-white dark:bg-dark-800 text-gray-800 dark:text-gray-200 rounded-lg border border-gray-300 dark:border-dark-600 focus:border-primary-500 focus:outline-none text-sm';

function LabeledSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-gray-500 dark:text-gray-400">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={filterSelectClass}
      >
        {children}
      </select>
    </div>
  );
}

export function RangeSelect({
  value,
  onChange,
}: {
  value: RangeDays;
  onChange: (days: RangeDays) => void;
}) {
  return (
    <LabeledSelect
      label="Date range"
      value={String(value)}
      onChange={(v) => {
        const n = Number(v);
        if (isRangeDays(n)) onChange(n);
      }}
    >
      {RANGE_OPTIONS.map((days) => (
        <option key={days} value={days}>
          Last {days} days
        </option>
      ))}
    </LabeledSelect>
  );
}

/** `null` = all platforms. */
export function PlatformSelect({
  value,
  platforms,
  onChange,
}: {
  value: Platform | null;
  platforms: readonly Platform[];
  onChange: (platform: Platform | null) => void;
}) {
  return (
    <LabeledSelect
      label="Platform"
      value={value ?? ''}
      onChange={(v) => onChange(isPlatform(v) ? v : null)}
    >
      <option value="">All platforms</option>
      {platforms.map((p) => (
        <option key={p} value={p}>
          {PLATFORM_SHORT[p]}
        </option>
      ))}
    </LabeledSelect>
  );
}

/** `null` = all categories. */
export function CategorySelect({
  value,
  categories,
  onChange,
}: {
  value: string | null;
  categories: readonly string[];
  onChange: (category: string | null) => void;
}) {
  return (
    <LabeledSelect label="Category" value={value ?? ''} onChange={(v) => onChange(v || null)}>
      <option value="">All categories</option>
      {categories.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </LabeledSelect>
  );
}

/** The white v1 filter bar. */
export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="bg-white dark:bg-dark-800 rounded-2xl p-4 mb-6 border border-gray-200 dark:border-dark-700 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-end gap-3 sm:gap-4">
      {children}
    </div>
  );
}
