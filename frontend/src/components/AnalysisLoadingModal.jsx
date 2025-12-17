import { Loader } from 'lucide-react';

const AnalysisLoadingModal = ({ isOpen, totalPrompts, completedPrompts }) => {
  if (!isOpen) return null;

  const progress = totalPrompts > 0 ? (completedPrompts / totalPrompts) * 100 : 0;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white dark:bg-dark-900 rounded-lg p-8 max-w-md w-full mx-4 border border-gray-200 dark:border-dark-700 shadow-2xl">
        <div className="flex flex-col items-center">
          {/* Animated Loader */}
          <div className="relative">
            <Loader className="w-16 h-16 text-primary-500 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 bg-primary-500 rounded-full opacity-20 animate-pulse"></div>
            </div>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mt-6 mb-2">
            Analyzing Visibility
          </h2>

          {/* Description */}
          <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
            Sending prompts to AI platforms and collecting responses...
          </p>

          {/* Progress Bar */}
          <div className="w-full bg-gray-200 dark:bg-dark-700 rounded-full h-3 mb-4 overflow-hidden">
            <div
              className="bg-[#4F46E5] h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            ></div>
          </div>

          {/* Progress Text */}
          <div className="text-gray-700 dark:text-gray-300 text-sm">
            <span className="font-semibold text-gray-800 dark:text-white">{completedPrompts}</span>
            {' / '}
            <span className="text-gray-500 dark:text-gray-400">{totalPrompts}</span>
            {' prompts analyzed'}
          </div>

          {/* Additional Info */}
          <div className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
            <p>This may take 30-60 seconds</p>
            <p className="mt-1">Please don't close this window</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalysisLoadingModal;
