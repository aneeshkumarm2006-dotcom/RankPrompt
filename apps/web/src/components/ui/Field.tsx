import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

/** v1 input look. */
export const inputClass =
  'w-full px-4 py-3 rounded-xl bg-white dark:bg-dark-800 border border-gray-300 dark:border-dark-600 text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-action-500 focus:border-transparent transition-all disabled:opacity-60';

const errorRing = 'border-red-500 dark:border-red-500 focus:ring-red-500';

/** Label + control + hint/error, wiring `id`, `aria-describedby` and `aria-invalid`. */
export function Field({
  label,
  hint,
  error,
  children,
  className = '',
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | undefined;
  children: (props: {
    id: string;
    'aria-describedby'?: string;
    'aria-invalid'?: boolean;
  }) => ReactNode;
  className?: string;
}) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
      >
        {label}
      </label>
      {children({
        id,
        ...(describedBy ? { 'aria-describedby': describedBy } : {}),
        ...(error ? { 'aria-invalid': true } : {}),
      })}
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

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }
>(function Input({ className = '', invalid, ...rest }, ref) {
  return (
    <input
      ref={ref}
      className={`${inputClass} ${invalid ? errorRing : ''} ${className}`}
      {...rest}
    />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }
>(function Select({ className = '', invalid, children, ...rest }, ref) {
  return (
    <select
      ref={ref}
      className={`${inputClass} ${invalid ? errorRing : ''} ${className}`}
      {...rest}
    >
      {children}
    </select>
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ className = '', invalid, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={`${inputClass} ${invalid ? errorRing : ''} ${className}`}
      {...rest}
    />
  );
});

/** v1 custom checkbox (sr-only input + purple box). */
export function Checkbox({
  checked,
  onChange,
  label,
  disabled = false,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  disabled?: boolean;
  description?: ReactNode;
}) {
  return (
    <label
      className={`flex items-start gap-3 group ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        aria-hidden
        className={`mt-0.5 w-5 h-5 shrink-0 rounded border-2 flex items-center justify-center transition-all peer-focus-visible:ring-2 peer-focus-visible:ring-action-500 ${
          checked
            ? 'bg-action-600 border-action-600'
            : 'border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-800 group-hover:border-gray-400'
        }`}
      >
        {checked && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </span>
      <span className="min-w-0">
        <span className="text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">
          {label}
        </span>
        {description && (
          <span className="block text-xs text-gray-500 dark:text-gray-400">{description}</span>
        )}
      </span>
    </label>
  );
}
