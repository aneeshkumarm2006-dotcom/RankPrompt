import type { ReactNode } from 'react';

/** Page title row: heading, optional description, actions on the right. */
export function PageHeader({
  title,
  description,
  actions,
  icon,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
      <div className="flex items-center gap-3 min-w-0">
        {icon}
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white truncate">
            {title}
          </h1>
          {description && <p className="mt-1 text-gray-500 dark:text-gray-400">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

/** White rounded card, the basic v1 panel. */
export function Card({
  children,
  className = '',
  title,
  actions,
}: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section
      className={`bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700 shadow-sm ${className}`}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 px-6 pt-5">
          {title && (
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white">{title}</h2>
          )}
          {actions}
        </div>
      )}
      <div className="p-6">{children}</div>
    </section>
  );
}
