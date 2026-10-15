import {
  meSchema,
  type GoogleBody,
  type LoginBody,
  type Me,
  type PatchMeBody,
  type RegisterBody,
} from '@pv/shared';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { ApiError, apiFetch } from './client';
import { queryKeys } from './queryKeys';

const none = z.undefined();

/**
 * The signed-in user, workspace, credits and limits (09: the single source for all of them).
 * `null` means "signed out"; any other error is a real failure.
 */
export function useMe() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: async ({ signal }): Promise<Me | null> => {
      try {
        return await apiFetch('/me', { schema: meSchema, signal });
      } catch (err) {
        if (err instanceof ApiError && (err.code === 'UNAUTHENTICATED' || err.status === 401)) {
          return null;
        }
        throw err;
      }
    },
    staleTime: 15_000,
  });
}

/** Every query except the public ones belongs to the old session. */
function resetSession(qc: QueryClient, me: Me | null) {
  qc.removeQueries({
    predicate: (q) => !['plans', 'meta', 'publicShare', 'health'].includes(String(q.queryKey[0])),
  });
  qc.setQueryData(queryKeys.me, me);
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: LoginBody) =>
      apiFetch('/auth/login', { method: 'POST', body, schema: meSchema }),
    onSuccess: (me) => resetSession(qc, me),
  });
}

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RegisterBody) =>
      apiFetch('/auth/register', { method: 'POST', body, schema: meSchema }),
    onSuccess: (me) => resetSession(qc, me),
  });
}

export function useGoogleSignIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: GoogleBody) =>
      apiFetch('/auth/google', { method: 'POST', body, schema: meSchema }),
    onSuccess: (me) => resetSession(qc, me),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch('/auth/logout', { method: 'POST', schema: none }),
    onSettled: () => resetSession(qc, null),
  });
}

export function useLogoutEverywhere() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch('/auth/logout-all', { method: 'POST', schema: none }),
    onSuccess: () => resetSession(qc, null),
  });
}

export function useVerifyEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (token: string) =>
      apiFetch('/auth/verify-email', { method: 'POST', body: { token }, schema: none }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.me }),
  });
}

export function useResendVerification() {
  return useMutation({
    mutationFn: () => apiFetch('/auth/resend-verification', { method: 'POST', schema: none }),
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) =>
      apiFetch('/auth/forgot-password', { method: 'POST', body: { email }, schema: none }),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (body: { token: string; password: string }) =>
      apiFetch('/auth/reset-password', { method: 'POST', body, schema: none }),
  });
}

export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PatchMeBody) => apiFetch('/me', { method: 'PATCH', body, schema: meSchema }),
    onSuccess: (me) => qc.setQueryData(queryKeys.me, me),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) =>
      apiFetch('/me/password', { method: 'POST', body, schema: none }),
  });
}
