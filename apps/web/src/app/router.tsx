import { lazy, type ComponentType } from 'react';
import { createBrowserRouter, Navigate, Outlet, useParams } from 'react-router';
import { PromoPopupHost } from '../features/promo/PromoPopupHost';
import { AppLayout, BareAppLayout } from './layout/AppLayout';
import { BrandLayout } from './layout/BrandLayout';
import { NotFoundPage } from './NotFoundPage';
import { RouteErrorPage } from './RouteErrorPage';

/** Code-split page: `page(() => import('./x'), 'XPage')`. */
function page<M extends Record<string, unknown>>(load: () => Promise<M>, name: keyof M & string) {
  return lazy(async () => ({ default: (await load())[name] as ComponentType }));
}

const LandingPage = page(() => import('../features/landing/LandingPage'), 'LandingPage');
const TermsPage = page(() => import('../features/landing/LegalPages'), 'TermsPage');
const PrivacyPage = page(() => import('../features/landing/LegalPages'), 'PrivacyPage');

const LoginPage = page(() => import('../features/auth/LoginPage'), 'LoginPage');
const RegisterPage = page(() => import('../features/auth/RegisterPage'), 'RegisterPage');
const VerifyEmailPage = page(() => import('../features/auth/VerifyEmailPage'), 'VerifyEmailPage');
const ForgotPasswordPage = page(
  () => import('../features/auth/ForgotPasswordPage'),
  'ForgotPasswordPage',
);
const ResetPasswordPage = page(
  () => import('../features/auth/ResetPasswordPage'),
  'ResetPasswordPage',
);

const BrandsPage = page(() => import('../features/brands/BrandsPage'), 'BrandsPage');
const NewBrandWizardPage = page(
  () => import('../features/brands/wizard/NewBrandWizardPage'),
  'NewBrandWizardPage',
);
const BrandSettingsPage = page(
  () => import('../features/brands/BrandSettingsPage'),
  'BrandSettingsPage',
);
const PromptLibraryPage = page(
  () => import('../features/prompts/PromptLibraryPage'),
  'PromptLibraryPage',
);
const OverviewPage = page(() => import('../features/insights/OverviewPage'), 'OverviewPage');
const CompetitorsPage = page(
  () => import('../features/insights/CompetitorsPage'),
  'CompetitorsPage',
);
const SourcesPage = page(() => import('../features/insights/SourcesPage'), 'SourcesPage');
const SchedulesPage = page(() => import('../features/schedules/SchedulesPage'), 'SchedulesPage');

const RunsPage = page(() => import('../features/runs/RunsPage'), 'RunsPage');
const BrandRunsPage = page(() => import('../features/runs/BrandRunsPage'), 'BrandRunsPage');
const NewRunPage = page(() => import('../features/runs/NewRunPage'), 'NewRunPage');
const RunPage = page(() => import('../features/runs/RunPage'), 'RunPage');
const SharedReportPage = page(
  () => import('../features/reports/SharedReportPage'),
  'SharedReportPage',
);

const BillingPage = page(() => import('../features/billing/BillingPage'), 'BillingPage');
const CreditsPage = page(() => import('../features/credits/CreditsPage'), 'CreditsPage');
const SettingsPage = page(() => import('../features/settings/SettingsPage'), 'SettingsPage');

/** v1 paths redirect to their v2 homes until cutover + 30 days (09 § Routes). */
function LegacyRedirect({ to }: { to: (params: Record<string, string | undefined>) => string }) {
  const params = useParams();
  return <Navigate to={to(params)} replace />;
}

/** Everything is wrapped so the promo popup can listen app-wide (F-33). */
function Root() {
  return (
    <>
      <Outlet />
      <PromoPopupHost />
    </>
  );
}

/** Route table (09 § Routes). */
export const router = createBrowserRouter([
  {
    element: <Root />,
    errorElement: <RouteErrorPage />,
    children: [
      { path: '/', element: <LandingPage /> },
      { path: '/terms', element: <TermsPage /> },
      { path: '/privacy', element: <PrivacyPage /> },
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/verify-email', element: <VerifyEmailPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/reset-password', element: <ResetPasswordPage /> },
      { path: '/share/:token', element: <SharedReportPage /> },

      {
        path: '/app',
        element: <AppLayout />,
        children: [
          { index: true, element: <Navigate to="/app/brands" replace /> },
          { path: 'brands', element: <BrandsPage /> },
          { path: 'brands/new', element: <NewBrandWizardPage /> },
          { path: 'runs', element: <RunsPage /> },
          { path: 'runs/:runId', element: <RunPage /> },
          { path: 'billing', element: <BillingPage /> },
          { path: 'credits', element: <CreditsPage /> },
          { path: 'settings', element: <SettingsPage /> },
        ],
      },
      {
        path: '/app/brands/:brandId',
        element: <BareAppLayout />,
        children: [
          {
            element: <BrandLayout />,
            children: [
              { index: true, element: <OverviewPage /> },
              { path: 'competitors', element: <CompetitorsPage /> },
              { path: 'prompts', element: <PromptLibraryPage /> },
              { path: 'runs', element: <BrandRunsPage /> },
              { path: 'runs/new', element: <NewRunPage /> },
              { path: 'sources', element: <SourcesPage /> },
              { path: 'schedules', element: <SchedulesPage /> },
              { path: 'settings', element: <BrandSettingsPage /> },
              { path: '*', element: <NotFoundPage /> },
            ],
          },
        ],
      },

      // ---- v1 paths ----
      { path: '/dashboard', element: <Navigate to="/app/brands" replace /> },
      { path: '/reports', element: <Navigate to="/app/runs" replace /> },
      { path: '/reports/new', element: <Navigate to="/app/brands/new" replace /> },
      { path: '/reports/:id', element: <LegacyRedirect to={(p) => `/app/runs/${p.id}`} /> },
      { path: '/shared/:token', element: <LegacyRedirect to={(p) => `/share/${p.token}`} /> },
      { path: '/brands', element: <Navigate to="/app/brands" replace /> },
      {
        path: '/brands/:id/dashboard',
        element: <LegacyRedirect to={(p) => `/app/brands/${p.id}`} />,
      },
      { path: '/brands/:id/*', element: <LegacyRedirect to={(p) => `/app/brands/${p.id}`} /> },
      { path: '/profile', element: <Navigate to="/app/settings" replace /> },
      { path: '/buy-credits', element: <Navigate to="/app/billing" replace /> },
      { path: '/earn-credits', element: <Navigate to="/app/credits" replace /> },

      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
