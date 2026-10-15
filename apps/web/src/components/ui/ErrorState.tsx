import { AlertCircle } from 'lucide-react';
import { errorMessage } from '../../lib/errors';
import { Button } from './Button';

export function ErrorState({
  error,
  title = 'Could not load this',
  onRetry,
}: {
  error: unknown;
  title?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center text-center gap-3 py-12 px-6 bg-white dark:bg-dark-800 rounded-2xl border border-red-200 dark:border-red-900/50"
    >
      <AlertCircle className="w-8 h-8 text-red-500" />
      <h3 className="font-semibold text-gray-800 dark:text-white">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400">{errorMessage(error)}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
