import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function EmptyState({
  icon: Icon,
  title,
  message,
  action,
}: {
  icon: LucideIcon;
  title: string;
  message?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="text-center py-16 px-6 bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700">
      <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-action-50 dark:bg-action-900/30 flex items-center justify-center">
        <Icon className="w-7 h-7 text-action-600 dark:text-action-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-1">{title}</h3>
      {message && <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">{message}</p>}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}
