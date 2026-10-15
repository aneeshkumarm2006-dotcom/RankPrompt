import { Plus, X } from 'lucide-react';
import { useId, useState, type KeyboardEvent } from 'react';
import { inputClass } from '../../components/ui/Field';
import { normText } from './brandForm';

const MAX_CHIP_LENGTH = 100;

/** Adds `raw` unless it is empty, too long, a repeat (ignoring case) or over `max`. */
export function addChip(list: readonly string[], raw: string, max: number): string[] {
  const value = normText(raw);
  if (!value || value.length > MAX_CHIP_LENGTH || list.length >= max) return [...list];
  if (list.some((x) => x.toLowerCase() === value.toLowerCase())) return [...list];
  return [...list, value];
}

/**
 * Chip editor for aliases (brand and competitors). Enter or comma adds, Backspace on an empty
 * input removes the last chip; `suggestions` not yet added are offered as one-click chips.
 */
export function ChipInput({
  label,
  value,
  onChange,
  max,
  placeholder = 'Type and press Enter',
  suggestions = [],
  hint,
  error,
  disabled = false,
  compact = false,
}: {
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  max: number;
  placeholder?: string;
  suggestions?: readonly string[];
  hint?: string;
  error?: string | undefined;
  disabled?: boolean;
  /** Smaller, label hidden visually (for table rows). */
  compact?: boolean;
}) {
  const id = useId();
  const [draft, setDraft] = useState('');
  const full = value.length >= max;
  const offered = suggestions.filter(
    (s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()),
  );

  const commit = () => {
    if (!draft.trim()) return;
    onChange(addChip(value, draft, max));
    setDraft('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div>
      <label
        htmlFor={id}
        className={
          compact
            ? 'sr-only'
            : 'flex items-center justify-between text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'
        }
      >
        <span>{label}</span>
        {!compact && (
          <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
            {value.length}/{max}
          </span>
        )}
      </label>
      <div
        className={`${inputClass} flex flex-wrap items-center gap-2 ${compact ? 'px-2 py-1.5' : 'px-3 py-2'} ${
          error ? 'border-red-500 dark:border-red-500' : ''
        }`}
      >
        {value.map((chip) => (
          <span
            key={chip}
            className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full text-sm bg-action-100 text-action-700 dark:bg-action-900/30 dark:text-action-300"
          >
            {chip}
            {!disabled && (
              <button
                type="button"
                aria-label={`Remove ${chip}`}
                onClick={() => onChange(value.filter((x) => x !== chip))}
                className="p-0.5 rounded-full hover:bg-action-200 dark:hover:bg-action-800/50"
              >
                <X className="w-3 h-3" aria-hidden />
              </button>
            )}
          </span>
        ))}
        <input
          id={id}
          value={draft}
          disabled={disabled || full}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={commit}
          maxLength={MAX_CHIP_LENGTH}
          placeholder={full ? `Maximum of ${max} reached` : placeholder}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className="flex-1 min-w-[8rem] bg-transparent border-0 p-1 text-sm focus:outline-none focus:ring-0 text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 disabled:cursor-not-allowed"
        />
      </div>
      {offered.length > 0 && !disabled && !full && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">Suggested:</span>
          {offered.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onChange(addChip(value, s, max))}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-sm border border-dashed border-gray-300 dark:border-dark-600 text-gray-600 dark:text-gray-300 hover:border-action-500 hover:text-action-600"
            >
              <Plus className="w-3 h-3" aria-hidden />
              {s}
            </button>
          ))}
        </div>
      )}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
