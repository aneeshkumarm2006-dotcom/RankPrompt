import {
  ledgerPageSchema,
  redirectUrlSchema,
  referralsResponseSchema,
  submitSurveyResponseSchema,
  subscriptionSchema,
  surveyStatusSchema,
  type PaidTier,
  type SurveyAnswers,
  type TopupPack,
} from '@pv/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import { toQuery } from './query';
import { queryKeys } from './queryKeys';

/** Sends the browser to the Stripe-hosted page. */
const go = ({ url }: { url: string }) => {
  window.location.assign(url);
};

// ---- Billing (Stage 6 implements these endpoints) -------------------------------------------

export function useSubscription() {
  return useQuery({
    queryKey: queryKeys.subscription,
    queryFn: ({ signal }) =>
      apiFetch('/billing/subscription', { schema: subscriptionSchema, signal }),
  });
}

export function useCheckout() {
  return useMutation({
    mutationFn: (tier: PaidTier) =>
      apiFetch('/billing/checkout', { method: 'POST', body: { tier }, schema: redirectUrlSchema }),
    onSuccess: go,
  });
}

export function useTopup() {
  return useMutation({
    mutationFn: (pack: TopupPack) =>
      apiFetch('/billing/topup', { method: 'POST', body: { pack }, schema: redirectUrlSchema }),
    onSuccess: go,
  });
}

export function useBillingPortal() {
  return useMutation({
    mutationFn: () => apiFetch('/billing/portal', { method: 'POST', schema: redirectUrlSchema }),
    onSuccess: go,
  });
}

// ---- Credits ---------------------------------------------------------------------------------

export function useLedger() {
  return useInfiniteQuery({
    queryKey: queryKeys.ledger,
    queryFn: ({ signal, pageParam }) =>
      apiFetch(`/credits/ledger${toQuery({ cursor: pageParam })}`, {
        schema: ledgerPageSchema,
        signal,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useReferrals() {
  return useQuery({
    queryKey: queryKeys.referrals,
    queryFn: ({ signal }) => apiFetch('/referrals', { schema: referralsResponseSchema, signal }),
  });
}

export function useSurveyStatus() {
  return useQuery({
    queryKey: queryKeys.survey,
    queryFn: ({ signal }) => apiFetch('/survey', { schema: surveyStatusSchema, signal }),
  });
}

export function useSubmitSurvey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (answers: SurveyAnswers) =>
      apiFetch('/survey', {
        method: 'POST',
        body: { answers },
        schema: submitSurveyResponseSchema,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.survey });
      void qc.invalidateQueries({ queryKey: queryKeys.me });
      void qc.invalidateQueries({ queryKey: queryKeys.ledger });
    },
  });
}
