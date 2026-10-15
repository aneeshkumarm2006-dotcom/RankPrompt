import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { ratioFraction, ratioPct, type RatioLike } from '../../lib/format';

const ACCENTS = {
  purple: 'from-action-500 to-purple-500',
  blue: 'from-primary-500 to-cyan-500',
  green: 'from-green-500 to-emerald-500',
  orange: 'from-orange-500 to-amber-500',
  red: 'from-accent-500 to-pink-500',
} as const;

export interface MetricTileProps {
  label: string;
  icon: LucideIcon;
  accent?: keyof typeof ACCENTS;
  /** A server ratio: shows `42%` with `{num}/{den}` underneath (09 § ReportView). */
  ratio?: RatioLike | null;
  /** Or any value, already formatted. */
  value?: ReactNode;
  hint?: ReactNode;
}

/** Stat card in the v1 ReportView style. Displays numbers; never computes them (05). */
export function MetricTile({
  label,
  icon: Icon,
  accent = 'purple',
  ratio,
  value,
  hint,
}: MetricTileProps) {
  return (
    <div className="bg-white dark:bg-dark-800 rounded-2xl p-5 border border-gray-200 dark:border-dark-700 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</span>
        <div className={`p-2 rounded-xl bg-gradient-to-br ${ACCENTS[accent]}`}>
          <Icon className="w-4 h-4 text-white" aria-hidden />
        </div>
      </div>
      <div className="text-3xl font-bold text-gray-800 dark:text-white">
        {ratio !== undefined ? ratioPct(ratio) : value}
      </div>
      {(ratio || hint) && (
        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {ratio ? ratioFraction(ratio) : null}
          {ratio && hint ? ' · ' : null}
          {hint}
        </div>
      )}
    </div>
  );
}
