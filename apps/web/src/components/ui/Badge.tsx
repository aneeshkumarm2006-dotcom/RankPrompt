import type { CheckStatus, RunStatus } from '@pv/shared';
import type { ReactNode } from 'react';

const TONES = {
  gray: 'bg-gray-100 text-gray-700 dark:bg-dark-700 dark:text-gray-300',
  green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  purple: 'bg-action-100 text-action-700 dark:bg-action-900/30 dark:text-action-300',
  orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
} as const;

export type BadgeTone = keyof typeof TONES;

export function Badge({
  tone = 'gray',
  children,
  className = '',
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

const RUN_STATUS: Record<RunStatus, { tone: BadgeTone; label: string }> = {
  queued: { tone: 'gray', label: 'Queued' },
  running: { tone: 'blue', label: 'Running' },
  finalizing: { tone: 'blue', label: 'Finishing' },
  completed: { tone: 'green', label: 'Completed' },
  partial: { tone: 'yellow', label: 'Partial' },
  failed: { tone: 'red', label: 'Failed' },
  canceled: { tone: 'gray', label: 'Canceled' },
};

export function RunStatusBadge({ status }: { status: RunStatus }) {
  const s = RUN_STATUS[status];
  return (
    <Badge tone={s.tone}>
      {(status === 'running' || status === 'finalizing') && (
        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" aria-hidden />
      )}
      {s.label}
    </Badge>
  );
}

const CHECK_STATUS: Record<CheckStatus, { tone: BadgeTone; label: string }> = {
  pending: { tone: 'gray', label: 'Pending' },
  running: { tone: 'blue', label: 'Running' },
  ok: { tone: 'green', label: 'Answered' },
  no_answer: { tone: 'yellow', label: 'No answer' },
  failed: { tone: 'red', label: 'Failed' },
  canceled: { tone: 'gray', label: 'Canceled' },
};

export function CheckStatusBadge({ status }: { status: CheckStatus }) {
  const s = CHECK_STATUS[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export const checkStatusLabel = (status: CheckStatus): string => CHECK_STATUS[status].label;
export const runStatusLabel = (status: RunStatus): string => RUN_STATUS[status].label;
