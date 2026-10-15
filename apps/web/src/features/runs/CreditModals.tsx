import type { PlanTier } from '@pv/shared';
import { AlertCircle, AlertTriangle, ArrowRight, CreditCard, Crown, Zap } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { number } from '../../lib/format';

/** v1 shows the low-credits warning at 10 credits or fewer (F-12). */
export const LOW_CREDITS_THRESHOLD = 10;

/** v1 InsufficientCreditsModal, driven by `POST /runs/estimate` (F-12). */
export function InsufficientCreditsModal({
  open,
  onClose,
  needed,
  available,
}: {
  open: boolean;
  onClose: () => void;
  needed: number;
  available: number;
}) {
  const navigate = useNavigate();
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Insufficient Credits"
      icon={
        <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center shrink-0">
          <AlertCircle className="w-6 h-6 text-red-500" />
        </div>
      }
    >
      <p className="text-gray-700 dark:text-gray-300 mb-4">
        You don’t have enough credits for this run. Each prompt on each platform costs 1 credit.
      </p>
      <div className="bg-gray-50 dark:bg-dark-800 rounded-lg p-4 space-y-2 mb-6">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Credits needed:</span>
          <span className="text-gray-800 dark:text-white font-semibold">{number(needed)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Credits available:</span>
          <span className="text-red-500 font-semibold">{number(available)}</span>
        </div>
        <div className="border-t border-gray-200 dark:border-dark-700 pt-2 mt-2 flex justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Credits short:</span>
          <span className="text-red-500 font-bold">{number(Math.max(0, needed - available))}</span>
        </div>
      </div>
      <div className="flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={onClose}>
          Cancel
        </Button>
        <Button
          className="flex-1"
          icon={<CreditCard className="w-4 h-4" />}
          onClick={() => {
            onClose();
            void navigate('/app/billing');
          }}
        >
          Buy Credits
        </Button>
      </div>
    </Modal>
  );
}

/** v1 LowCreditsModal: warns, then lets the user continue (F-12). */
export function LowCreditsModal({
  open,
  onClose,
  onContinue,
  creditsAfter,
  tier,
}: {
  open: boolean;
  onClose: () => void;
  onContinue: () => void;
  creditsAfter: number;
  tier: PlanTier;
}) {
  const navigate = useNavigate();
  const toBilling = () => {
    onClose();
    void navigate('/app/billing');
  };
  const free = tier === 'free';

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Low Credits Alert"
      icon={
        <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center shrink-0">
          <AlertTriangle className="w-6 h-6 text-amber-500" />
        </div>
      }
    >
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        You’ll have {number(creditsAfter)} credits left after this run.
      </p>
      {free ? (
        <div className="bg-gradient-to-br from-primary-500/10 to-accent-500/10 dark:from-primary-500/20 dark:to-accent-500/20 rounded-xl p-4 border border-primary-500/20 mb-4">
          <div className="flex items-start gap-3">
            <Zap className="w-5 h-5 text-primary-500 mt-0.5" />
            <div>
              <h3 className="font-semibold text-gray-800 dark:text-white mb-1">
                Unlock More Power
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Upgrade to a subscription plan to get monthly credits for regular tracking.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-amber-500/10 dark:bg-amber-500/20 rounded-xl p-4 border border-amber-500/20 mb-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            You’re on the{' '}
            <span className="font-semibold text-primary-600 dark:text-primary-400 capitalize">
              {tier}
            </span>{' '}
            plan. Consider topping up your credits or upgrading for a higher monthly allowance.
          </p>
        </div>
      )}
      <div className="flex flex-col gap-3">
        <Button
          variant="gradient"
          size="lg"
          icon={free ? <Crown className="w-5 h-5" /> : <CreditCard className="w-5 h-5" />}
          onClick={toBilling}
        >
          {free ? 'View Subscription Plans' : 'Buy More Credits'}
          <ArrowRight className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            onClose();
            onContinue();
          }}
        >
          Continue Anyway
        </Button>
      </div>
    </Modal>
  );
}
