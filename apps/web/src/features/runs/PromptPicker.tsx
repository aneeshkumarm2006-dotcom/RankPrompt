import type { Prompt } from '@pv/shared';
import { useMemo } from 'react';
import { Checkbox } from '../../components/ui/Field';

/**
 * Pick prompts for a run or a fixed schedule, grouped by category. Selection is capped at the
 * plan's prompts-per-run limit (F-36); the server checks it as well (422 TOO_MANY_PROMPTS).
 */
export function PromptPicker({
  prompts,
  value,
  onChange,
  max,
  error,
}: {
  prompts: Prompt[];
  value: string[];
  onChange: (ids: string[]) => void;
  max: number;
  error?: string | undefined;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, Prompt[]>();
    for (const p of prompts) map.set(p.category, [...(map.get(p.category) ?? []), p]);
    return [...map.entries()];
  }, [prompts]);

  const selected = new Set(value);
  const full = value.length >= max;
  const allIds = prompts.map((p) => p.id);

  const setMany = (ids: string[], on: boolean) => {
    if (!on) return onChange(value.filter((id) => !ids.includes(id)));
    const next = [...value];
    for (const id of ids) if (!selected.has(id) && next.length < max) next.push(id);
    onChange(next);
  };

  return (
    <fieldset>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <legend className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Prompts{' '}
          <span className="text-gray-500 dark:text-gray-400 font-normal">
            ({value.length} of {prompts.length} selected, max {max})
          </span>
        </legend>
        <div className="flex gap-3 text-sm">
          <button
            type="button"
            className="text-action-600 dark:text-action-400 hover:underline"
            onClick={() => setMany(allIds, true)}
          >
            Select {prompts.length > max ? `first ${max}` : 'all'}
          </button>
          <button
            type="button"
            className="text-gray-500 dark:text-gray-400 hover:underline"
            onClick={() => onChange([])}
          >
            Clear
          </button>
        </div>
      </div>
      <div className="max-h-80 overflow-y-auto space-y-4 pr-1 rounded-xl border border-gray-200 dark:border-dark-700 p-4 bg-white dark:bg-dark-900">
        {groups.map(([category, items]) => {
          const ids = items.map((p) => p.id);
          const all = ids.every((id) => selected.has(id));
          return (
            <div key={category}>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {category}
                </h4>
                <button
                  type="button"
                  className="text-xs text-action-600 dark:text-action-400 hover:underline"
                  onClick={() => setMany(ids, !all)}
                >
                  {all ? 'None' : 'All'}
                </button>
              </div>
              <div className="space-y-2">
                {items.map((p) => (
                  <Checkbox
                    key={p.id}
                    checked={selected.has(p.id)}
                    disabled={!selected.has(p.id) && full}
                    onChange={(on) => setMany([p.id], on)}
                    label={<span className="text-sm">{p.text}</span>}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {full && prompts.length > max && (
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Your plan allows {max} prompts per run.
        </p>
      )}
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </fieldset>
  );
}
