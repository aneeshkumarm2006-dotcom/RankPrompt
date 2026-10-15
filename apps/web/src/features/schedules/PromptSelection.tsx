import type { Prompt, PromptSelectionMode } from '@pv/shared';
import { ExternalLink } from 'lucide-react';
import { Link } from 'react-router';
import { pluralize } from '../../lib/format';
import { PromptPicker } from '../runs/PromptPicker';

/**
 * All active prompts vs a fixed subset (10 § Prompt selection). Prompts are edited only in the
 * prompt library; v1's second editor here lost data.
 */
export function PromptSelection({
  brandId,
  prompts,
  mode,
  promptIds,
  max,
  onChange,
  error,
}: {
  brandId: string;
  /** The brand's active prompts. */
  prompts: Prompt[];
  mode: PromptSelectionMode;
  promptIds: string[];
  max: number;
  onChange: (next: { mode: PromptSelectionMode; promptIds: string[] }) => void;
  error?: string | undefined;
}) {
  const option = (value: PromptSelectionMode, title: string, description: string) => (
    <label
      className={`flex-1 grid grid-cols-[auto_1fr] gap-x-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
        mode === value
          ? 'border-action-500 bg-action-50 dark:bg-action-900/20'
          : 'border-gray-200 dark:border-dark-700 hover:border-gray-300 dark:hover:border-dark-600'
      }`}
    >
      <input
        type="radio"
        name="prompt-selection"
        value={value}
        checked={mode === value}
        onChange={() => onChange({ mode: value, promptIds })}
        className="mt-1 row-span-2 accent-action-600"
      />
      <span className="font-medium text-gray-800 dark:text-white">{title}</span>
      <span className="sr-only">: </span>
      <span className="text-xs text-gray-500 dark:text-gray-400">{description}</span>
    </label>
  );

  return (
    <fieldset className="space-y-4">
      <legend className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
        Prompts
      </legend>
      <div className="flex flex-col sm:flex-row gap-3">
        {option(
          'all_active',
          `All active prompts (${prompts.length})`,
          'Prompts you add to the library later are included automatically.',
        )}
        {option('fixed', 'A fixed set', 'Only the prompts you pick below.')}
      </div>

      {mode === 'fixed' && (
        <PromptPicker
          prompts={prompts}
          value={promptIds}
          onChange={(ids) => onChange({ mode, promptIds: ids })}
          max={max}
          error={error}
        />
      )}
      {mode === 'all_active' && prompts.length > max && (
        <p className="text-xs text-yellow-700 dark:text-yellow-400">
          This brand has {pluralize(prompts.length, 'active prompt')}; your plan runs at most {max}{' '}
          per run.
        </p>
      )}
      {mode === 'all_active' && error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <p className="text-xs text-gray-500 dark:text-gray-400">
        To add or edit prompts, use the{' '}
        <Link
          to={`/app/brands/${brandId}/prompts`}
          className="inline-flex items-center gap-1 text-action-600 dark:text-action-400 hover:underline"
        >
          prompt library <ExternalLink className="w-3 h-3" aria-hidden />
        </Link>
        .
      </p>
    </fieldset>
  );
}
