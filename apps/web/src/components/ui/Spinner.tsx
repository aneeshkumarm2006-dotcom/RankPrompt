const SPINNER_SIZES = {
  sm: 'h-5 w-5 border-2',
  md: 'h-10 w-10 border-t-4 border-b-4',
  lg: 'h-16 w-16 border-t-4 border-b-4',
} as const;

/** v1 loading spinner (ProtectedRoute and pages). */
export function Spinner({
  size = 'md',
  label,
}: {
  size?: keyof typeof SPINNER_SIZES;
  label?: string;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-4"
      role="status"
      aria-live="polite"
    >
      <div
        className={`inline-block animate-spin rounded-full border-primary-500 ${SPINNER_SIZES[size]}`}
      />
      {label ? (
        <p className="text-gray-600 dark:text-gray-300">{label}</p>
      ) : (
        <span className="sr-only">Loading…</span>
      )}
    </div>
  );
}

/** Full-area loading state used by pages. */
export function PageSpinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <Spinner size="lg" label={label} />
    </div>
  );
}
