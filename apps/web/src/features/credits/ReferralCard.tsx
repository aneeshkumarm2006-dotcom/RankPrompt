import { Check, Copy, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Spinner } from '../../components/ui/Spinner';
import { useReferrals } from '../../lib/api/billing';
import { errorMessage, isNotFound } from '../../lib/errors';
import { number, pluralize } from '../../lib/format';

function CopyRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      toast.error('Could not copy. Select the text and copy it instead.');
    }
  };

  return (
    <div className="mb-4">
      <p className="text-gray-500 dark:text-gray-400 text-xs mb-2">{label}</p>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="flex-1 bg-gray-100 dark:bg-dark-800 rounded-xl p-3 sm:p-4 overflow-hidden">
          <span
            className={`text-gray-800 dark:text-white break-all ${mono ? 'font-mono text-lg font-bold' : 'text-sm'}`}
          >
            {value}
          </span>
        </div>
        <button
          type="button"
          onClick={() => void copy()}
          aria-label={`Copy ${label.toLowerCase()}`}
          className="bg-gray-100 dark:bg-dark-800 hover:bg-gray-200 dark:hover:bg-dark-700 p-3 sm:p-4 rounded-xl transition-all flex items-center justify-center gap-2"
        >
          {copied ? (
            <Check className="w-5 h-5 text-green-500" aria-hidden />
          ) : (
            <Copy className="w-5 h-5 text-gray-400 dark:text-gray-500" aria-hidden />
          )}
          <span className="text-gray-600 dark:text-gray-300 text-sm font-medium">
            {copied ? 'Copied' : 'Copy'}
          </span>
        </button>
      </div>
    </div>
  );
}

const Stat = ({ label, value }: { label: string; value: number }) => (
  <div className="bg-gray-100 dark:bg-dark-800 rounded-xl p-3 text-center">
    <p className="text-2xl font-bold text-gray-800 dark:text-white">{number(value)}</p>
    <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
  </div>
);

/** v1 "Invite your colleagues" card (F-28): link, code and counts from `/referrals`. */
export function ReferralCard({ reward }: { reward: number | undefined }) {
  const referrals = useReferrals();
  const rewardText = reward === undefined ? 'free credits' : pluralize(reward, 'free credit');

  return (
    <section className="bg-white dark:bg-dark-900/50 dark:border-dark-700 rounded-2xl border border-gray-200 p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-5 h-5 text-blue-400" aria-hidden />
        <h2 className="text-lg font-bold text-gray-800 dark:text-white">Invite your colleagues</h2>
      </div>
      <p className="text-gray-600 dark:text-gray-300 text-sm mb-6">
        Share your link. You get{' '}
        <span className="text-primary-500 font-semibold">{rewardText}</span> for each person who
        signs up with it, once they verify their email.
      </p>

      {referrals.isPending ? (
        <Spinner size="sm" />
      ) : referrals.isError ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {isNotFound(referrals.error)
            ? 'Referrals will be available soon.'
            : errorMessage(referrals.error)}
        </p>
      ) : (
        <>
          <CopyRow label="Shareable link" value={referrals.data.link} />
          <CopyRow label="Referral code" value={referrals.data.code} mono />
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Signed up" value={referrals.data.referredCount} />
            <Stat label="Verified" value={referrals.data.creditedCount} />
            <Stat label="Credits earned" value={referrals.data.creditsEarned} />
          </div>
        </>
      )}

      <div className="mt-6 space-y-2">
        <h3 className="text-gray-800 dark:text-white font-semibold">How it works</h3>
        {[
          'Share your referral link or code with colleagues',
          'They sign up with it and verify their email',
          `You get ${rewardText} for each one`,
        ].map((text, i) => (
          <div key={text} className="flex items-start gap-3">
            <span className="shrink-0 w-6 h-6 rounded-full bg-primary-500/20 flex items-center justify-center mt-0.5 text-primary-500 text-xs font-bold">
              {i + 1}
            </span>
            <p className="text-gray-600 dark:text-gray-300 text-sm">{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
