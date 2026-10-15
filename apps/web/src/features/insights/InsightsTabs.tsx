import { NavLink } from 'react-router';

/** "Overview · Competitors" tab bar at the top of the brand dashboard (v1 PerformanceSummary). */
export function InsightsTabs({ brandId }: { brandId: string }) {
  const base = `/app/brands/${brandId}`;
  const tabs = [
    { to: base, label: 'Overview', end: true },
    { to: `${base}/competitors`, label: 'Competitors', end: false },
  ];
  return (
    <nav
      aria-label="Dashboard tabs"
      className="flex items-center gap-6 border-b border-gray-200 dark:border-dark-700 mb-6 overflow-x-auto"
    >
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) =>
            `pb-3 -mb-px text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              isActive
                ? 'border-action-600 text-action-600 dark:text-action-400 dark:border-action-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
            }`
          }
        >
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
