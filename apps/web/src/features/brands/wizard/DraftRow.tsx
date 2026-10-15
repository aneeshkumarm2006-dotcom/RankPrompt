import { Trash2 } from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import { Select, Textarea } from '../../../components/ui/Field';
import type { Draft } from './useWizard';

/** One reviewable prompt (v1 Step3ReadyToAnalyze row): edit text, change category, delete. */
export function DraftRow({
  index,
  draft,
  categories,
  error,
  onChange,
  onRemove,
}: {
  index: number;
  draft: Draft;
  categories: readonly string[];
  error?: string | undefined;
  onChange: (patch: Partial<Draft>) => void;
  onRemove: () => void;
}) {
  return (
    <li className="bg-gray-50 dark:bg-dark-800 rounded-xl p-3 sm:p-4">
      <div className="flex items-start gap-3">
        <span className="mt-2.5 w-6 shrink-0 text-right text-xs text-gray-400" aria-hidden>
          {index + 1}
        </span>
        <div className="flex-1 min-w-0 space-y-2">
          <Textarea
            aria-label={`Prompt ${index + 1}`}
            rows={2}
            maxLength={500}
            value={draft.text}
            invalid={Boolean(error)}
            onChange={(e) => onChange({ text: e.target.value })}
            className="py-2 text-sm resize-y"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Select
              aria-label={`Category for prompt ${index + 1}`}
              value={draft.category}
              onChange={(e) => onChange({ category: e.target.value })}
              className="!w-auto py-1.5 text-sm"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <Badge tone={draft.source === 'generated' ? 'purple' : 'blue'}>
              {draft.source === 'generated' ? 'Generated' : 'Custom'}
            </Badge>
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>
        <button
          type="button"
          aria-label={`Delete prompt ${index + 1}`}
          onClick={onRemove}
          className="p-2.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
        >
          <Trash2 className="w-4 h-4" aria-hidden />
        </button>
      </div>
    </li>
  );
}
