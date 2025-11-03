import { X } from 'lucide-react';

const SaveBrandModal = ({ isOpen, onClose, brandData, onSave, onSkip }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg max-w-md w-full border border-gray-700 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Save Brand?</h2>
          <button
            onClick={onSkip}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Brand Info */}
          <div className="flex items-center gap-4 mb-6 bg-gray-700 rounded-lg p-4">
            {brandData?.favicon ? (
              <img
                src={brandData.favicon}
                alt={brandData.brandName}
                className="w-12 h-12 rounded-lg"
                onError={(e) => {
                  e.target.src = `https://www.google.com/s2/favicons?domain=${brandData.websiteUrl}&sz=64`;
                }}
              />
            ) : (
              <div className="w-12 h-12 bg-gray-600 rounded-lg flex items-center justify-center">
                <span className="text-white text-xl font-bold">
                  {brandData?.brandName?.charAt(0) || '?'}
                </span>
              </div>
            )}
            <div className="flex-1">
              <div className="text-white font-semibold">{brandData?.brandName}</div>
              <div className="text-gray-400 text-sm">{brandData?.websiteUrl}</div>
            </div>
          </div>

          <p className="text-gray-300 mb-6">
            Would you like to save this brand to your account for quick access later?
          </p>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onSave}
              className="flex-1 bg-primary-500 hover:bg-primary-600 text-white font-medium py-3 px-6 rounded-lg transition-colors"
            >
              Yes, Save Brand
            </button>
            <button
              onClick={onSkip}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white font-medium py-3 px-6 rounded-lg transition-colors"
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
