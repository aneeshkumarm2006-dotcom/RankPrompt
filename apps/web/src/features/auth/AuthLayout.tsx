import type { ReactNode } from 'react';
import { BrandLogo } from '../landing/BrandLogo';

/** The v1 Login/Register card: soft blobs, big logo, glass card with a title. */
export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-950 flex items-center justify-center px-4 sm:px-6 lg:px-8 relative overflow-hidden py-12">
      <div className="absolute inset-0" aria-hidden>
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary-500/10 dark:bg-primary-500/20 rounded-full blur-3xl animate-float" />
        <div
          className="absolute bottom-20 right-10 w-96 h-96 bg-accent-500/10 dark:bg-accent-500/20 rounded-full blur-3xl animate-float"
          style={{ animationDelay: '2s' }}
        />
      </div>

      <main className="relative max-w-md w-full">
        <BrandLogo className="justify-center mb-8" />
        <div className="glass-effect rounded-3xl p-8 shadow-lg dark:shadow-2xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-black text-gray-800 dark:text-white mb-2">{title}</h1>
            {subtitle && <p className="text-gray-600 dark:text-gray-300">{subtitle}</p>}
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

/** v1 red error box above the form. */
export function FormAlert({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="mb-6 p-4 rounded-xl bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-300 text-sm"
    >
      {children}
    </div>
  );
}

/** The "or" divider between the form and Google sign-in. */
export function OrDivider() {
  return (
    <div className="my-4 flex items-center" aria-hidden>
      <div className="flex-1 border-t border-gray-200 dark:border-dark-700" />
      <span className="px-4 text-sm text-gray-500 dark:text-gray-400">or</span>
      <div className="flex-1 border-t border-gray-200 dark:border-dark-700" />
    </div>
  );
}

export const authLinkClass =
  'text-action-600 hover:text-action-700 dark:text-action-500 dark:hover:text-action-400 font-semibold transition-colors';
