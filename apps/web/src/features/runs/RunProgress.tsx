import type { RunProgress as RunProgressData } from '@pv/shared';
import { number } from '../../lib/format';

export type SegmentKey = 'ok' | 'noAnswer' | 'failed' | 'canceled' | 'pending';

export interface ProgressSegment {
  key: SegmentKey;
  label: string;
  count: number;
  /** Share of the bar, 0–100 (display only). */
  width: number;
  className: string;
}

const SEGMENTS: { key: SegmentKey; label: string; className: string }[] = [
  { key: 'ok', label: 'Answered', className: 'bg-green-500' },
  { key: 'noAnswer', label: 'No answer', className: 'bg-yellow-400' },
  { key: 'failed', label: 'Failed', className: 'bg-red-500' },
  { key: 'canceled', label: 'Canceled', className: 'bg-gray-400' },
  { key: 'pending', label: 'Pending', className: 'bg-gray-200 dark:bg-dark-700' },
];

/** The bar's segments from the server's progress counts (`pending` includes running checks). */
export function progressSegments(progress: RunProgressData): ProgressSegment[] {
  const total = Math.max(progress.total, 1);
  return SEGMENTS.map((s) => ({
    ...s,
    count: progress[s.key],
    width: (progress[s.key] / total) * 100,
  }));
}

/** Checks that are finished one way or another. */
export const doneChecks = (progress: RunProgressData): number => progress.total - progress.pending;

/** Segmented progress bar plus a legend with counts (F-11, v1 progress modal look). */
export function RunProgress({ progress }: { progress: RunProgressData }) {
  const segments = progressSegments(progress);
  const done = doneChecks(progress);
  const percent = progress.total > 0 ? Math.round((done / progress.total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-gray-800 dark:text-white font-medium">Overall progress</span>
        <span className="font-bold text-primary-500">
          {number(done)} / {number(progress.total)} checks · {percent}%
        </span>
      </div>
      <div
        className="w-full h-4 flex bg-gray-200 dark:bg-dark-700 rounded-full overflow-hidden"
        role="progressbar"
        aria-label="Run progress"
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-valuenow={done}
      >
        {segments
          .filter((s) => s.count > 0)
          .map((s) => (
            <div
              key={s.key}
              data-segment={s.key}
              className={`h-full transition-all duration-500 ease-out ${s.className}`}
              style={{ width: `${s.width}%` }}
              title={`${s.label}: ${s.count}`}
            />
          ))}
      </div>
      <ul className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-3">
        {segments.map((s) => (
          <li
            key={s.key}
            className="bg-white dark:bg-dark-800 rounded-xl p-3 text-center border border-gray-200 dark:border-dark-700"
          >
            <div className="text-2xl font-bold text-gray-800 dark:text-white">
              {number(s.count)}
            </div>
            <div className="mt-1 inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <span className={`w-2 h-2 rounded-full ${s.className}`} aria-hidden />
              {s.label}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
