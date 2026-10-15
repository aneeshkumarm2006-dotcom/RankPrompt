import { AlertTriangle } from 'lucide-react';
import { Link, useRouteError } from 'react-router';
import { buttonClass } from '../components/ui/Button';

/** Shown when a page throws while rendering, or a lazy chunk fails to load (e.g. after a deploy). */
export function RouteErrorPage() {
  const error = useRouteError();
  const chunkFailed =
    error instanceof Error && /dynamically imported module|Failed to fetch/i.test(error.message);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <AlertTriangle className="w-12 h-12 text-accent-500 mx-auto mb-4" aria-hidden />
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
          {chunkFailed ? 'A new version is available' : 'Something went wrong'}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          {chunkFailed
            ? 'Reload the page to get the latest version of PromptVerse.'
            : 'This page hit an unexpected error. Reloading usually fixes it.'}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            type="button"
            className={buttonClass('primary')}
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
          <Link to="/" className={buttonClass('outline')}>
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
