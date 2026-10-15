import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useMe } from '../lib/api/auth';
import { ErrorState } from '../components/ui/ErrorState';
import { Spinner } from '../components/ui/Spinner';

/** Signed-in only; otherwise to /login, remembering where the user was going. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const me = useMe();
  const location = useLocation();

  if (me.isPending) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <Spinner size="lg" label="Loading…" />
      </div>
    );
  }
  if (me.isError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <ErrorState
          error={me.error}
          title="Could not reach PromptVerse"
          onRetry={() => void me.refetch()}
        />
      </div>
    );
  }
  if (!me.data) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }
  return children;
}

/** Signed-out only (login, register): a signed-in user goes straight to the app. */
export function RedirectIfSignedIn({
  children,
  to = '/app/brands',
}: {
  children: ReactNode;
  to?: string;
}) {
  const me = useMe();
  if (me.isPending) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }
  if (me.data) return <Navigate to={to} replace />;
  return children;
}

/** Only same-app paths are allowed as `?next=` targets (no open redirects). */
export function safeNext(next: string | null, fallback = '/app/brands'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\'))
    return fallback;
  return next;
}
