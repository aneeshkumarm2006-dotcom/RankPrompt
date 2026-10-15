import { SURVEY_QUESTIONS } from '@pv/shared';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Button } from '../../components/ui/Button';
import { Textarea } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { useSubmitSurvey } from '../../lib/api/billing';
import { errorMessage, isNotFound } from '../../lib/errors';
import { pluralize } from '../../lib/format';
import {
  EMPTY_SURVEY_DRAFT,
  isAnswered,
  parseSurveyDraft,
  toggleChoice,
  type SurveyDraft,
} from './surveyDraft';

const TOTAL = SURVEY_QUESTIONS.length;

const optionClass = (selected: boolean) =>
  `w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${
    selected
      ? 'bg-purple-100 dark:bg-purple-500/10 border-primary-500 text-gray-800 dark:text-white'
      : 'bg-white dark:bg-dark-800 border-gray-200 dark:border-dark-700 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-dark-600'
  }`;

/** v1 SurveyModal: six questions, one at a time, with a progress bar (F-31). */
export function SurveyModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<SurveyDraft>(EMPTY_SURVEY_DRAFT);
  const [error, setError] = useState<string | null>(null);
  const submit = useSubmitSurvey();

  const q = SURVEY_QUESTIONS[step] ?? SURVEY_QUESTIONS[0];
  const last = step === TOTAL - 1;
  const progress = Math.round(((step + 1) / TOTAL) * 100);
  const answered = isAnswered(q, draft);

  const set = (patch: Partial<SurveyDraft>) => {
    setError(null);
    setDraft((d) => ({ ...d, ...patch }));
  };

  const send = () => {
    const parsed = parseSurveyDraft(draft);
    if (!parsed.ok) return setError(parsed.message);
    submit.mutate(parsed.answers, {
      onSuccess: ({ creditsAwarded }) => {
        toast.success(`Thanks for the feedback! ${pluralize(creditsAwarded, 'credit')} added.`);
        onClose();
      },
      onError: (err) =>
        setError(
          isNotFound(err)
            ? 'The survey is being rebuilt and will be available soon.'
            : errorMessage(err),
        ),
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title={`Question ${step + 1} of ${TOTAL}`}
      footer={
        <div className="flex w-full items-center justify-between">
          <Button
            variant="secondary"
            icon={<ChevronLeft className="w-4 h-4" />}
            onClick={() => setStep((s) => s - 1)}
            className={step === 0 ? 'invisible' : ''}
            disabled={step === 0}
          >
            Back
          </Button>
          <Button
            onClick={last ? send : () => setStep((s) => s + 1)}
            disabled={!answered}
            loading={submit.isPending}
          >
            {last ? 'Submit' : 'Next'}
            {!last && <ChevronRight className="w-4 h-4" aria-hidden />}
          </Button>
        </div>
      }
    >
      <div
        className="w-full h-1 bg-gray-200 dark:bg-dark-700 rounded-full overflow-hidden mb-6"
        role="progressbar"
        aria-label="Survey progress"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full bg-primary-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <h3 id="survey-question" className="text-gray-800 dark:text-white text-lg font-bold mb-4">
        {q.question}
      </h3>

      {q.type === 'single' && (
        <div className="space-y-2" role="group" aria-labelledby="survey-question">
          {q.options.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={draft[q.key] === option}
              className={optionClass(draft[q.key] === option)}
              onClick={() => set({ [q.key]: option })}
            >
              {option}
            </button>
          ))}
        </div>
      )}

      {q.type === 'multiple' && (
        <div className="space-y-2" role="group" aria-labelledby="survey-question">
          {q.options.map((option) => {
            const selected = draft.aiFeatures.includes(option);
            return (
              <button
                key={option}
                type="button"
                aria-pressed={selected}
                className={optionClass(selected)}
                onClick={() => set({ aiFeatures: toggleChoice(draft.aiFeatures, option, q.max) })}
              >
                {option}
              </button>
            );
          })}
          <p className="text-gray-500 dark:text-gray-400 text-xs mt-2">
            Select up to {q.max} options
          </p>
        </div>
      )}

      {q.type === 'scale' && (
        <div role="group" aria-labelledby="survey-question">
          <div className="flex flex-wrap items-center justify-between gap-1">
            {Array.from({ length: q.max - q.min + 1 }, (_, i) => q.min + i).map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={draft.recommend === n}
                onClick={() => set({ recommend: n })}
                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg font-bold transition-all ${
                  draft.recommend === n
                    ? 'bg-primary-500 text-white scale-110'
                    : 'bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-700'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between mt-3 text-gray-500 dark:text-gray-400 text-xs">
            <span>Not likely</span>
            <span>Very likely</span>
          </div>
        </div>
      )}

      {q.type === 'text' && (
        <Textarea
          aria-labelledby="survey-question"
          value={draft.wishlist}
          maxLength={2000}
          rows={4}
          placeholder="Share your thoughts... (optional)"
          className="resize-none"
          onChange={(e) => set({ wishlist: e.target.value })}
        />
      )}

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </Modal>
  );
}
