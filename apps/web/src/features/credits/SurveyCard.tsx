import { Check, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { useSurveyStatus } from '../../lib/api/billing';
import { errorMessage, isNotFound } from '../../lib/errors';
import { formatDate, pluralize } from '../../lib/format';
import { SurveyModal } from './SurveyModal';

/** v1 "Quick survey" card (F-31): earn `grants.survey` credits once. */
export function SurveyCard({ reward }: { reward: number | undefined }) {
  const status = useSurveyStatus();
  const [open, setOpen] = useState(false);
  const rewardText = reward === undefined ? 'free credits' : pluralize(reward, 'free credit');

  return (
    <section className="bg-white dark:bg-dark-900/50 dark:border-dark-700 rounded-2xl border border-gray-200 p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-5 h-5 text-purple-400" aria-hidden />
        <h2 className="text-lg font-bold text-gray-800 dark:text-white">
          Quick survey (2 minutes)
        </h2>
      </div>
      <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">
        Help us improve PromptVerse by sharing your feedback. You’ll get{' '}
        <span className="text-primary-500 font-semibold">{rewardText}</span> instantly.
      </p>

      {status.isPending ? (
        <Spinner size="sm" />
      ) : status.isError ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {isNotFound(status.error)
            ? 'The survey is being rebuilt and will be available soon.'
            : errorMessage(status.error)}
        </p>
      ) : status.data.completed ? (
        <div className="inline-flex items-center gap-2 bg-gray-100 dark:bg-dark-800 px-4 py-2 rounded-lg">
          <Check className="w-5 h-5 text-green-500" aria-hidden />
          <span className="text-green-600 dark:text-green-400 font-medium">
            Completed on {formatDate(status.data.completedAt)}
          </span>
        </div>
      ) : (
        <Button
          variant="gradient"
          icon={<Sparkles className="w-4 h-4" />}
          onClick={() => setOpen(true)}
        >
          {reward === undefined ? 'Take the survey' : `Earn ${pluralize(reward, 'credit')}`}
        </Button>
      )}

      {open && <SurveyModal onClose={() => setOpen(false)} />}
    </section>
  );
}
