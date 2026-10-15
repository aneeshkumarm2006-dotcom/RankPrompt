import { Loader } from 'lucide-react';
import { createPortal } from 'react-dom';

/**
 * v1 AnalysisLoadingModal look, for the slow AI calls in the wizard (brand analysis, prompt
 * generation). It can't be dismissed: the request is already running on the server.
 */
export function BusyOverlay({
  open,
  title,
  message,
}: {
  open: boolean;
  title: string;
  message: string;
}) {
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div
        role="status"
        aria-live="polite"
        className="bg-white dark:bg-dark-900 rounded-2xl p-8 max-w-md w-full mx-4 border border-gray-200 dark:border-dark-700 shadow-2xl"
      >
        <div className="flex flex-col items-center text-center">
          <div className="relative">
            <Loader className="w-16 h-16 text-primary-500 animate-spin" aria-hidden />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 bg-primary-500 rounded-full opacity-20 animate-pulse" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mt-6 mb-2">{title}</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{message}</p>
          <div className="w-full bg-gray-200 dark:bg-dark-700 rounded-full h-2 overflow-hidden">
            <div className="h-full w-1/3 bg-action-600 rounded-full animate-pulse" />
          </div>
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            This usually takes 15–60 seconds.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
