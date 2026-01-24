import { X, AlertTriangle, CreditCard, Zap, Crown, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const LowCreditsModal = ({ isOpen, onClose, credits, currentPlan }) => {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const isFreeUser = !currentPlan || currentPlan === 'free';

  const handleUpgrade = () => {
    onClose();
    navigate('/buy-credits');
  };

  const handleBuyCredits = () => {
    onClose();
    navigate('/buy-credits');
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white dark:bg-dark-900 rounded-2xl p-6 max-w-md w-full mx-4 border border-gray-200 dark:border-dark-700 shadow-2xl animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">Low Credits Alert</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">You have {credits} credits remaining</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content based on plan */}
        {isFreeUser ? (
          // Free User Content
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-primary-500/10 to-accent-500/10 dark:from-primary-500/20 dark:to-accent-500/20 rounded-xl p-4 border border-primary-500/20">
              <div className="flex items-start gap-3">
                <Zap className="w-5 h-5 text-primary-500 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-gray-800 dark:text-white mb-1">Unlock More Power</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Upgrade to a subscription plan to get monthly credits and access premium features like white-label exports and priority support.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-dark-800 rounded-xl p-4">
              <h4 className="font-semibold text-gray-800 dark:text-white mb-3">Why Upgrade?</h4>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <div className="w-1.5 h-1.5 bg-primary-500 rounded-full"></div>
                  Get up to 1000 credits per month
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <div className="w-1.5 h-1.5 bg-primary-500 rounded-full"></div>
                  Access all AI platforms
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <div className="w-1.5 h-1.5 bg-primary-500 rounded-full"></div>
                  White-label exports & team collaboration
                </li>
              </ul>
            </div>

            {/* CTA for Free Users */}
            <div className="flex flex-col gap-3 pt-2">
              <button
                onClick={handleUpgrade}
                className="w-full bg-gradient-to-r from-primary-500 to-accent-500 hover:from-primary-600 hover:to-accent-600 text-white px-6 py-3.5 rounded-xl font-bold transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-primary-500/25"
              >
                <Crown className="w-5 h-5" />
                View Subscription Plans
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="w-full px-4 py-2.5 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors text-sm"
              >
                Maybe Later
              </button>
            </div>
          </div>
        ) : (
          // Subscribed User Content
          <div className="space-y-4">
            <div className="bg-amber-500/10 dark:bg-amber-500/20 rounded-xl p-4 border border-amber-500/20">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                You're on the <span className="font-semibold text-primary-600 dark:text-primary-400 capitalize">{currentPlan}</span> plan. 
                Consider topping up your credits or upgrading your subscription for increased monthly limits.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 dark:bg-dark-800 rounded-xl p-4 text-center">
                <CreditCard className="w-6 h-6 text-primary-500 mx-auto mb-2" />
                <h4 className="font-semibold text-gray-800 dark:text-white text-sm mb-1">Buy Credits</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">Top up instantly</p>
              </div>
              <div className="bg-gray-50 dark:bg-dark-800 rounded-xl p-4 text-center">
                <Crown className="w-6 h-6 text-accent-500 mx-auto mb-2" />
                <h4 className="font-semibold text-gray-800 dark:text-white text-sm mb-1">Upgrade Plan</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">Get more monthly</p>
              </div>
            </div>

            {/* CTAs for Subscribed Users */}
            <div className="flex flex-col gap-3 pt-2">
              <button
                onClick={handleBuyCredits}
                className="w-full bg-primary-500 hover:bg-primary-600 text-white px-6 py-3.5 rounded-xl font-bold transition-all duration-300 flex items-center justify-center gap-2"
              >
                <CreditCard className="w-5 h-5" />
                Buy More Credits
              </button>
              <button
                onClick={handleUpgrade}
                className="w-full bg-gradient-to-r from-accent-500 to-primary-500 hover:from-accent-600 hover:to-primary-600 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center gap-2"
              >
                <Crown className="w-4 h-4" />
                Upgrade Subscription
              </button>
              <button
                onClick={onClose}
                className="w-full px-4 py-2.5 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors text-sm"
              >
                Continue Anyway
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LowCreditsModal;
