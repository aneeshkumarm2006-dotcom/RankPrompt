import {
  ArrowLeft,
  BarChart3,
  Calendar,
  ChevronDown,
  FileText,
  ListChecks,
  Menu,
  Settings,
  Share2,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Suspense, useState } from 'react';
import { Link, NavLink, Outlet, useParams } from 'react-router';
import { Badge } from '../../components/ui/Badge';
import { BrandAvatar } from '../../components/ui/BrandAvatar';
import { ErrorState } from '../../components/ui/ErrorState';
import { PageSpinner } from '../../components/ui/Spinner';
import { VerifyEmailBanner } from '../../features/auth/VerifyEmailBanner';
import { useBrand } from '../../lib/api/brands';
import { prettyUrl } from '../../lib/format';

interface NavItem {
  name: string;
  to: string;
  icon: LucideIcon;
  end?: boolean;
}

/**
 * v1 BrandSidebar with the v2 brand routes. The "Soon" items are gone (F-46); Brand Settings
 * works now (F-18), and Competitors is a tab of the dashboard group.
 */
function BrandSidebar({ brandId }: { brandId: string }) {
  const { data: brand } = useBrand(brandId);
  const [open, setOpen] = useState(false);
  const [dashboardOpen, setDashboardOpen] = useState(true);
  const base = `/app/brands/${brandId}`;

  const dashboard: NavItem[] = [
    { name: 'Performance Summary', to: base, icon: BarChart3, end: true },
    { name: 'Competitors', to: `${base}/competitors`, icon: Users },
    { name: 'All Prompts', to: `${base}/prompts`, icon: ListChecks },
    { name: 'All Reports', to: `${base}/runs`, icon: FileText },
    { name: 'Scheduled Reports', to: `${base}/schedules`, icon: Calendar },
  ];
  const others: NavItem[] = [
    { name: 'Citations & Sources', to: `${base}/sources`, icon: Share2 },
    { name: 'Brand Settings', to: `${base}/settings`, icon: Settings },
  ];

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
      isActive
        ? 'bg-primary-500 text-white'
        : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-dark-700'
    }`;

  return (
    <>
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-gray-100 dark:bg-dark-900 border-b border-gray-200 dark:border-dark-700 p-4 z-40 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          className="text-gray-800 dark:text-gray-200 p-2 hover:bg-gray-200 dark:hover:bg-dark-700 rounded-lg flex-shrink-0"
        >
          {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <BrandAvatar name={brand?.name ?? 'B'} domain={brand?.domain} size="sm" />
          <span className="text-gray-800 dark:text-white font-semibold truncate">
            {brand?.name ?? 'Brand'}
          </span>
        </div>
      </div>

      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-gray-100 dark:bg-dark-900 border-r border-gray-200 dark:border-dark-700 z-50 transform transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="flex flex-col h-full">
          <Link
            to="/app/brands"
            className="flex items-center gap-2 px-4 py-3 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-dark-700 transition-colors border-b border-gray-200 dark:border-dark-700"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to Brands</span>
          </Link>

          <div className="px-4 py-4 border-b border-gray-200 dark:border-dark-700">
            <div className="flex items-center gap-3">
              <BrandAvatar name={brand?.name ?? 'B'} domain={brand?.domain} />
              <div className="flex-1 min-w-0">
                <h2 className="text-gray-800 dark:text-white font-semibold text-sm truncate">
                  {brand?.name ?? '…'}
                </h2>
                <p className="text-gray-500 dark:text-gray-400 text-xs truncate">
                  {brand ? prettyUrl(brand.websiteUrl) : ''}
                </p>
              </div>
            </div>
            {brand?.archivedAt && (
              <Badge tone="gray" className="mt-3">
                Archived
              </Badge>
            )}
          </div>

          <nav className="flex-1 overflow-y-auto py-4 px-2" aria-label="Brand">
            <button
              type="button"
              onClick={() => setDashboardOpen(!dashboardOpen)}
              aria-expanded={dashboardOpen}
              className="w-full flex items-center justify-between px-3 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-700 rounded-lg transition-colors mb-1"
            >
              <div className="flex items-center gap-3">
                <BarChart3 className="w-5 h-5" />
                <span className="text-sm font-medium">AI Visibility Dashboard</span>
              </div>
              <ChevronDown
                className={`w-4 h-4 transition-transform ${dashboardOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {dashboardOpen && (
              <div className="ml-6 space-y-1 mb-2">
                {dashboard.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end ?? false}
                    onClick={() => setOpen(false)}
                    className={linkClass}
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.name}</span>
                  </NavLink>
                ))}
              </div>
            )}
            {others.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors mb-1 ${
                    isActive
                      ? 'bg-primary-500 text-white'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-dark-700'
                  }`
                }
              >
                <item.icon className="w-5 h-5" />
                <span className="text-sm font-medium">{item.name}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </aside>

      {open && (
        <button
          type="button"
          aria-label="Close menu"
          tabIndex={-1}
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
}

/** `/app/brands/:brandId/*`: brand sidebar + page (v1 BrandDashboard). */
export function BrandLayout() {
  const { brandId = '' } = useParams();
  const brand = useBrand(brandId);

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] dark:bg-dark-950 overflow-x-hidden">
      <BrandSidebar brandId={brandId} />
      <main className="flex-1 lg:ml-64 mt-16 lg:mt-0 min-w-0 overflow-x-hidden">
        <VerifyEmailBanner />
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          {brand.isPending ? (
            <PageSpinner label="Loading brand…" />
          ) : brand.isError ? (
            <ErrorState error={brand.error} title="Could not load this brand" />
          ) : (
            <Suspense fallback={<PageSpinner />}>
              <Outlet context={{ brand: brand.data }} />
            </Suspense>
          )}
        </div>
      </main>
    </div>
  );
}
