import type { CheckResult, CheckStatus, Platform } from '@pv/shared';
import { PlatformLabel } from '../../components/ui/PlatformIcon';
import { number } from '../../lib/format';

export type StatusCounts = Record<CheckStatus, number>;

const EMPTY: StatusCounts = { pending: 0, running: 0, ok: 0, no_answer: 0, failed: 0, canceled: 0 };

/** Counts loaded result rows per platform and status: display only, not a metric (05). */
export function countByPlatform(
  platforms: Platform[],
  results: Pick<CheckResult, 'platform' | 'status'>[],
): Record<Platform, StatusCounts> {
  const out = {} as Record<Platform, StatusCounts>;
  for (const p of platforms) out[p] = { ...EMPTY };
  for (const r of results) {
    out[r.platform] ??= { ...EMPTY };
    out[r.platform][r.status] += 1;
  }
  return out;
}

const BAR: { key: CheckStatus; className: string }[] = [
  { key: 'ok', className: 'bg-green-500' },
  { key: 'no_answer', className: 'bg-yellow-400' },
  { key: 'failed', className: 'bg-red-500' },
  { key: 'canceled', className: 'bg-gray-400' },
  { key: 'running', className: 'bg-blue-400 animate-pulse' },
];

/** Per-platform progress while a run is going (09 § Run progress). */
export function PlatformBreakdown({
  platforms,
  results,
}: {
  platforms: Platform[];
  results: Pick<CheckResult, 'platform' | 'status'>[];
}) {
  const counts = countByPlatform(platforms, results);
  return (
    <ul className="space-y-3">
      {platforms.map((p) => {
        const c = counts[p];
        const total = Object.values(c).reduce((a, b) => a + b, 0);
        const done = c.ok + c.no_answer + c.failed + c.canceled;
        return (
          <li key={p}>
            <div className="flex items-center justify-between gap-3 text-sm mb-1">
              <PlatformLabel platform={p} className="text-gray-800 dark:text-gray-200" />
              <span className="text-gray-500 dark:text-gray-400">
                {number(done)} / {number(total)}
                {c.running > 0 && ` · ${number(c.running)} running`}
                {c.failed > 0 && ` · ${number(c.failed)} failed`}
              </span>
            </div>
            <div className="h-2 flex rounded-full bg-gray-200 dark:bg-dark-700 overflow-hidden">
              {total > 0 &&
                BAR.map(({ key, className }) =>
                  c[key] > 0 ? (
                    <div
                      key={key}
                      className={`h-full ${className}`}
                      style={{ width: `${(c[key] / total) * 100}%` }}
                    />
                  ) : null,
                )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
