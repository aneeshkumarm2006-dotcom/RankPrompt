import { X } from 'lucide-react';

const SaveBrandModal = ({ isOpen, onClose, brandData, onSave, onSkip, isLoading = false }) => {
  if (!isOpen) return null;

  const handleSaveClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onSave) {
      onSave();
    }
  };

  const handleSkipClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onSkip) {
      onSkip();
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      handleSkipClick(e);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={handleOverlayClick}
    >
      <div
        className="bg-white dark:bg-dark-900 rounded-xl sm:rounded-lg max-w-md w-full border border-gray-200 dark:border-dark-700 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-dark-700">
          <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">Save Brand?</h2>
          <button
            type="button"
            onClick={handleSkipClick}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6">
          {/* Brand Info */}
          <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6 bg-white dark:bg-dark-800 rounded-lg p-3 sm:p-4">
            {brandData?.favicon ? (
              <img
                src={brandData.favicon}
                alt={brandData.brandName}
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg"
                onError={(e) => {
                  e.target.src = `https://www.google.com/s2/favicons?domain=${brandData.websiteUrl}&sz=64`;
                }}
              />
            ) : (
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-200 dark:bg-dark-700 rounded-lg flex items-center justify-center">
                <span className="text-gray-800 dark:text-gray-200 text-lg sm:text-xl font-bold">
                  {brandData?.brandName?.charAt(0) || '?'}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-gray-800 dark:text-white font-semibold text-sm sm:text-base break-words">{brandData?.brandName}</div>
              <div className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm break-all">{brandData?.websiteUrl}</div>
            </div>
          </div>

          <p className="text-gray-700 dark:text-gray-300 text-sm sm:text-base mb-4 sm:mb-6">
            Would you like to save this brand to your account for quick access later?
          </p>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={handleSaveClick}
              onTouchEnd={(e) => {
                e.preventDefault();
                handleSaveClick(e);
              }}
              disabled={isLoading}
              className="flex-1 bg-primary-500 hover:bg-primary-600 active:bg-primary-700 disabled:bg-primary-400 disabled:cursor-not-allowed disabled:opacity-60 text-white font-medium py-2.5 sm:py-3 px-4 sm:px-6 rounded-lg transition-colors text-sm sm:text-base touch-manipulation cursor-pointer flex items-center justify-center"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : (
                'Yes, Save Brand'
              )}
            </button>
            <button
              type="button"
              onClick={handleSkipClick}
              onTouchEnd={(e) => {
                e.preventDefault();
                handleSkipClick(e);
              }}
              disabled={isLoading}
              className="flex-1 bg-gray-200 dark:bg-dark-700 hover:bg-gray-300 dark:hover:bg-dark-600 active:bg-gray-400 dark:active:bg-dark-500 disabled:bg-gray-300 dark:disabled:bg-dark-600 disabled:cursor-not-allowed disabled:opacity-60 text-gray-800 dark:text-gray-200 font-medium py-2.5 sm:py-3 px-4 sm:px-6 rounded-lg transition-colors text-sm sm:text-base touch-manipulation cursor-pointer"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              No, Skip
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SaveBrandModal;
