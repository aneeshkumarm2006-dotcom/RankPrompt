import { X, AlertCircle, CreditCard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const InsufficientCreditsModal = ({ isOpen, onClose, creditsNeeded, creditsAvailable }) => {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleBuyCredits = () => {
    onClose();
    navigate('/buy-credits');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-white">Insufficient Credits</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="mb-6">
          <p className="text-gray-300 mb-4">
            You don't have enough credits to generate this report.
          </p>
          <div className="bg-gray-900 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Credits Needed:</span>
              <span className="text-white font-semibold">{creditsNeeded}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Credits Available:</span>
              <span className="text-red-400 font-semibold">{creditsAvailable}</span>
            </div>
            <div className="border-t border-gray-700 pt-2 mt-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Credits Short:</span>
                <span className="text-red-400 font-bold">{creditsNeeded - creditsAvailable}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleBuyCredits}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-primary-500 to-accent-500 hover:from-primary-600 hover:to-accent-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <CreditCard className="w-4 h-4" />
            Buy Credits
          </button>
        </div>
      </div>
    </div>
  );
};

export default InsufficientCreditsModal;
