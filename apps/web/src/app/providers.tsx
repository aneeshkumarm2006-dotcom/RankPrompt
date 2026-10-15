import { GoogleOAuthProvider } from '@react-oauth/google';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Toaster } from 'react-hot-toast';
import { ApiError } from '../lib/api/client';
import { GOOGLE_CLIENT_ID } from '../lib/config';
import { ThemeProvider } from './theme/ThemeContext';

/** Retry network blips and 5xx a couple of times; a 4xx answer won't change on retry. */
const shouldRetry = (failureCount: number, error: unknown): boolean => {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 2;
};

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: shouldRetry, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
}

/** v1 toast look (App.jsx). */
function AppToaster() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: '#ffffff',
          color: '#374151',
          border: '1px solid #e5e7eb',
          borderRadius: '12px',
          padding: '16px',
          boxShadow: '0 10px 30px rgba(15,23,42,0.08)',
        },
        success: { iconTheme: { primary: '#22c55e', secondary: '#ecfdf3' } },
        error: { iconTheme: { primary: '#ef4444', secondary: '#fef2f2' } },
      }}
    />
  );
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);

  const app = (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        {children}
        <AppToaster />
      </ThemeProvider>
    </QueryClientProvider>
  );

  // Google sign-in is optional: without a client id the buttons are hidden.
  return GOOGLE_CLIENT_ID ? (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>{app}</GoogleOAuthProvider>
  ) : (
    app
  );
}
