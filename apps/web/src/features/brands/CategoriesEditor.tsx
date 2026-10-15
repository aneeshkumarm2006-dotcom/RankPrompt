import { MAX_CATEGORIES, type Category } from '@pv/shared';
import { Plus, Trash2 } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Field';
import { categoryErrors } from './brandForm';

/** Brand categories: name + description rows, at most 10, unique names (F-08). */
export function CategoriesEditor({
  value,
  onChange,
  errors = {},
  disabled = false,
}: {
  value: Category[];
  onChange: (next: Category[]) => void;
  /** Server/client errors keyed `categories.N.name`. */
  errors?: Record<string, string>;
  disabled?: boolean;
}) {
  const local = categoryErrors(value);
  const update = (i: number, patch: Partial<Category>) =>
    onChange(value.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  return (
    <fieldset>
      <legend className="flex w-full items-center justify-between text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        <span>Categories</span>
        <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
          {value.length}/{MAX_CATEGORIES}
        </span>
      </legend>
      {value.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          No categories yet. Prompts are grouped by category in reports.
        </p>
      )}
      <ul className="space-y-3">
        {value.map((c, i) => {
          const error = errors[`categories.${i}.name`] ?? local[i];
          // Index keys: rows have no id, and the name is what's being edited.
          return (
            <li
              key={i}
              className="rounded-xl border border-gray-200 dark:border-dark-700 p-3 bg-gray-50 dark:bg-dark-900"
            >
              <div className="flex items-start gap-2">
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Input
                    aria-label={`Category ${i + 1} name`}
                    value={c.name}
                    maxLength={100}
                    placeholder="Category name"
                    invalid={Boolean(error)}
                    disabled={disabled}
                    onChange={(e) => update(i, { name: e.target.value })}
                    className="py-2"
                  />
                  <Input
                    aria-label={`Category ${i + 1} description`}
                    value={c.description}
                    maxLength={500}
                    placeholder="Short description (optional)"
                    disabled={disabled}
                    onChange={(e) => update(i, { description: e.target.value })}
                    className="py-2 sm:col-span-2"
                  />
                </div>
                {c.source === 'generated' && (
                  <Badge tone="purple" className="mt-2.5 hidden sm:inline-flex">
                    AI
                  </Badge>
                )}
                {!disabled && (
                  <button
                    type="button"
                    aria-label={`Remove category ${c.name || i + 1}`}
                    onClick={() => onChange(value.filter((_, j) => j !== i))}
                    className="p-2.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden />
                  </button>
                )}
              </div>
              {error && <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{error}</p>}
            </li>
          );
        })}
      </ul>
      {!disabled && value.length < MAX_CATEGORIES && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-3"
          icon={<Plus className="w-4 h-4" />}
          onClick={() => onChange([...value, { name: '', description: '', source: 'custom' }])}
        >
          Add category
        </Button>
      )}
      {errors.categories && (
        <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.categories}</p>
      )}
    </fieldset>
  );
}
