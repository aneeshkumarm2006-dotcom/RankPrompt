import { MAX_CATEGORIES, type Category } from '@pv/shared';
import { Check, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Field';
import { normText } from '../brandForm';

/** Picks which categories to keep: generated ones as v1 cards, plus custom ones (F-08). */
export function CategoryPicker({
  options,
  value,
  onChange,
  error,
}: {
  /** Generated categories offered by the analysis. */
  options: readonly { name: string; description: string }[];
  /** The chosen categories, generated and custom, in order. */
  value: Category[];
  onChange: (next: Category[]) => void;
  error?: string | undefined;
}) {
  const [custom, setCustom] = useState('');
  const [customError, setCustomError] = useState<string>();
  const full = value.length >= MAX_CATEGORIES;
  const key = (name: string) => normText(name).toLowerCase();
  const isSelected = (name: string) => value.some((c) => key(c.name) === key(name));

  const toggle = (opt: { name: string; description: string }) => {
    if (isSelected(opt.name)) onChange(value.filter((c) => key(c.name) !== key(opt.name)));
    else if (!full) onChange([...value, { ...opt, source: 'generated' }]);
  };

  const addCustom = () => {
    const name = normText(custom);
    if (!name) return;
    if (isSelected(name)) {
      setCustomError('That category is already selected');
      return;
    }
    const generated = options.find((o) => key(o.name) === key(name));
    onChange([
      ...value,
      generated
        ? { ...generated, source: 'generated' }
        : { name, description: '', source: 'custom' },
    ]);
    setCustom('');
    setCustomError(undefined);
  };

  const customOnes = value.filter((c) => !options.some((o) => key(o.name) === key(c.name)));

  return (
    <fieldset>
      <legend className="flex w-full flex-wrap items-center justify-between gap-2 mb-3">
        <span className="text-gray-800 dark:text-white font-medium">
          Business categories (up to {MAX_CATEGORIES})
        </span>
        <span className="text-action-600 dark:text-action-400 text-sm font-semibold">
          {value.length}/{MAX_CATEGORIES} selected
        </span>
      </legend>

      <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
        {options.map((opt) => {
          const on = isSelected(opt.name);
          return (
            <button
              key={opt.name}
              type="button"
              aria-pressed={on}
              disabled={!on && full}
              onClick={() => toggle(opt)}
              className={`w-full text-left p-4 rounded-xl transition-all border-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                on
                  ? 'bg-action-50 dark:bg-action-500/10 border-action-600 dark:border-action-500'
                  : 'bg-gray-100 dark:bg-dark-800 hover:bg-gray-200 dark:hover:bg-dark-700 border-transparent'
              }`}
            >
              <span className="flex items-center gap-2 mb-1">
                <span className="text-gray-800 dark:text-white font-medium">{opt.name}</span>
                {on && <Check className="w-4 h-4 text-action-600" aria-hidden />}
              </span>
              {opt.description && (
                <span className="block text-gray-600 dark:text-gray-400 text-sm">
                  {opt.description}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {customOnes.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Custom categories">
          {customOnes.map((c) => (
            <li
              key={c.name}
              className="inline-flex items-center gap-1 pl-3 pr-1 py-1 rounded-full text-sm bg-action-100 text-action-700 dark:bg-action-900/30 dark:text-action-300"
            >
              {c.name}
              <button
                type="button"
                aria-label={`Remove ${c.name}`}
                onClick={() => onChange(value.filter((x) => x !== c))}
                className="p-0.5 rounded-full hover:bg-action-200 dark:hover:bg-action-800/50"
              >
                <X className="w-3 h-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      {!full && (
        <div className="mt-3">
          <div className="flex gap-2">
            <Input
              aria-label="Custom category name"
              value={custom}
              maxLength={100}
              placeholder="Add a custom category"
              onChange={(e) => {
                setCustom(e.target.value);
                setCustomError(undefined);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCustom();
                }
              }}
              className="py-2"
            />
            <Button
              variant="outline"
              icon={<Plus className="w-4 h-4" />}
              onClick={addCustom}
              disabled={!custom.trim()}
            >
              Add
            </Button>
          </div>
          {customError && (
            <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{customError}</p>
          )}
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </fieldset>
  );
}
