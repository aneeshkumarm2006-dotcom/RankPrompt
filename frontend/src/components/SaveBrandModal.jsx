import { X } from 'lucide-react';

const SaveBrandModal = ({ isOpen, onClose, brandData, onSave, onSkip }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-xl sm:rounded-lg max-w-md w-full border border-gray-700 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-700">
          <h2 className="text-lg sm:text-xl font-bold text-white">Save Brand?</h2>
          <button
            onClick={onSkip}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6">
          {/* Brand Info */}
          <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6 bg-gray-700 rounded-lg p-3 sm:p-4">
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
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-600 rounded-lg flex items-center justify-center">
                <span className="text-white text-lg sm:text-xl font-bold">
                  {brandData?.brandName?.charAt(0) || '?'}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-white font-semibold text-sm sm:text-base break-words">{brandData?.brandName}</div>
              <div className="text-gray-400 text-xs sm:text-sm break-all">{brandData?.websiteUrl}</div>
            </div>
          </div>

          <p className="text-gray-300 text-sm sm:text-base mb-4 sm:mb-6">
            Would you like to save this brand to your account for quick access later?
          </p>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onSave}
              className="flex-1 bg-primary-500 hover:bg-primary-600 text-white font-medium py-2.5 sm:py-3 px-4 sm:px-6 rounded-lg transition-colors text-sm sm:text-base"
            >
              Yes, Save Brand
            </button>
            <button
              onClick={onSkip}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white font-medium py-2.5 sm:py-3 px-4 sm:px-6 rounded-lg transition-colors text-sm sm:text-base"
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
