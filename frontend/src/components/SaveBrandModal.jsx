import { X } from 'lucide-react';

const SaveBrandModal = ({ isOpen, onClose, brandData, onSave, onSkip }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-25 z-50 flex items-center justify-center p-4">
      <div className="bg-[#F8FAFC] rounded-xl sm:rounded-lg max-w-md w-full border border-gray-200 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-700">
          <h2 className="text-lg sm:text-xl font-bold text-gray-800">Save Brand?</h2>
          <button
            onClick={onSkip}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6">
          {/* Brand Info */}
          <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6 bg-white rounded-lg p-3 sm:p-4">
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
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-200 rounded-lg flex items-center justify-center">
                <span className="text-gray-800 text-lg sm:text-xl font-bold">
                  {brandData?.brandName?.charAt(0) || '?'}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-gray-800 font-semibold text-sm sm:text-base break-words">{brandData?.brandName}</div>
              <div className="text-gray-600 text-xs sm:text-sm break-all">{brandData?.websiteUrl}</div>
            </div>
          </div>

          <p className="text-gray-700 text-sm sm:text-base mb-4 sm:mb-6">
            Would you like to save this brand to your account for quick access later?
          </p>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onSave}
              className="flex-1 bg-[#4F46E5] hover:bg-purple-700 text-white font-medium py-2.5 sm:py-3 px-4 sm:px-6 rounded-lg transition-colors text-sm sm:text-base"
            >
              Yes, Save Brand
            </button>
            <button
              onClick={onSkip}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2.5 sm:py-3 px-4 sm:px-6 rounded-lg transition-colors text-sm sm:text-base"
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
