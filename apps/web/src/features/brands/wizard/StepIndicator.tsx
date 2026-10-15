import { Check } from 'lucide-react';
import { Fragment } from 'react';
import { WIZARD_STEPS, type WizardStep } from './useWizard';

/** v1 Reports.jsx step indicator: numbered circles, green checks for done steps. */
export function StepIndicator({ current }: { current: WizardStep }) {
  return (
    <nav
      aria-label="Setup progress"
      className="flex justify-center mb-8 sm:mb-12 overflow-x-auto px-2"
    >
      <ol className="flex items-center gap-2 sm:gap-4 min-w-max">
        {WIZARD_STEPS.map(({ step, label }, i) => {
          const done = step < current;
          const active = step === current;
          return (
            <Fragment key={step}>
              {i > 0 && (
                <li
                  aria-hidden
                  className={`w-8 sm:w-16 h-0.5 ${step <= current ? 'bg-green-500' : 'bg-gray-300 dark:bg-dark-700'}`}
                />
              )}
              <li className="flex items-center" aria-current={active ? 'step' : undefined}>
                <span
                  className={`flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 text-sm font-semibold transition-all ${
                    active
                      ? 'bg-primary-500 border-primary-500 text-white'
                      : done
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'border-gray-300 dark:border-dark-600 text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {done ? <Check className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden /> : step}
                </span>
                <span
                  className={`ml-1 sm:ml-2 text-xs sm:text-sm font-medium ${active ? '' : 'hidden sm:inline'} ${
                    step <= current
                      ? 'text-gray-800 dark:text-gray-200'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {label}
                  {done && <span className="sr-only"> (done)</span>}
                </span>
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
