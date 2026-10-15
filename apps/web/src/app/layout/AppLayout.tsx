import { Suspense } from 'react';
import { Outlet } from 'react-router';
import { PageSpinner } from '../../components/ui/Spinner';
import { VerifyEmailBanner } from '../../features/auth/VerifyEmailBanner';
import { RequireAuth } from '../RequireAuth';
import { Sidebar } from './Sidebar';

/** Signed-in layout: v1 sidebar on the left, page on the right. */
export function AppLayout() {
  return (
    <RequireAuth>
      <div className="flex min-h-screen bg-[#F8FAFC] dark:bg-dark-950 overflow-x-hidden">
        <Sidebar />
        <main className="flex-1 lg:ml-64 min-w-0">
          <VerifyEmailBanner />
          <div className="p-4 pt-20 lg:pt-8 sm:p-6 lg:p-8 max-w-7xl mx-auto">
            <Suspense fallback={<PageSpinner />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </RequireAuth>
  );
}

/** Brand pages bring their own sidebar (v1 BrandDashboard), so they skip the main one. */
export function BareAppLayout() {
  return (
    <RequireAuth>
      <Suspense fallback={<PageSpinner />}>
        <Outlet />
      </Suspense>
    </RequireAuth>
  );
}
