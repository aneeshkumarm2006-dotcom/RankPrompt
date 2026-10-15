import { PLATFORM_LABELS, PLATFORMS, type PlansResponse, type PlanTier } from '@pv/shared';
import { ArrowRight, Check, Crown, Gift, Sparkles, Zap, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router';
import { ErrorState } from '../../components/ui/ErrorState';
import { Spinner } from '../../components/ui/Spinner';
import { useMe } from '../../lib/api/auth';
import { usePlans } from '../../lib/api/meta';
import { money, number, pluralize } from '../../lib/format';

type PlanInfo = PlansResponse['plans'][number];

/** Marketing copy per tier. Prices, credits and limits always come from `GET /plans` (06). */
const COPY: Partial<Record<PlanTier, { subtitle: string; icon: LucideIcon }>> = {
  starter: {
    subtitle: 'For individuals looking to explore AI visibility and scan key prompts.',
    icon: Zap,
  },
  pro: {
    subtitle: 'For companies and teams ready to monitor AI rankings more actively.',
    icon: Crown,
  },
  agency: {
    subtitle: 'For agencies managing multiple clients, campaigns or brands.',
    icon: Sparkles,
  },
};

const HIGHLIGHTED: PlanTier = 'pro';

function platformsLabel(platforms: PlanInfo['limits']['platforms']): string {
  const names = platforms.map((p) => PLATFORM_LABELS[p]).join(', ');
  return platforms.length === PLATFORMS.length
    ? `All AI platforms (${names})`
    : `${pluralize(platforms.length, 'AI platform')} (${names})`;
}

function planFeatures(plan: PlanInfo): string[] {
  return [
    `${number(plan.monthlyCredits)} credits/month`,
    platformsLabel(plan.limits.platforms),
    `Up to ${pluralize(plan.limits.brands, 'brand')}`,
    `Up to ${number(plan.limits.maxPromptsPerRun)} prompts per run`,
  ];
}

function PlanCard({ plan, ctaTo }: { plan: PlanInfo; ctaTo: string }) {
  const highlighted = plan.tier === HIGHLIGHTED;
  const copy = COPY[plan.tier];
  const Icon = copy?.icon ?? Zap;
  const perCredit =
    plan.monthlyCredits > 0
      ? money(Math.round(plan.priceCentsMonthly / plan.monthlyCredits))
      : null;

  return (
    <div className={`relative group ${highlighted ? 'md:scale-105' : ''}`}>
      {highlighted && (
        <div className="absolute -top-5 left-1/2 transform -translate-x-1/2 z-20">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-primary-500 to-accent-500 rounded-full blur" />
            <div className="relative bg-gradient-to-r from-primary-500 to-accent-500 text-white px-6 py-2 rounded-full text-sm font-bold flex items-center space-x-1">
              <Crown className="w-4 h-4" aria-hidden />
              <span>Recommended</span>
            </div>
          </div>
        </div>
      )}

      <div
        className={`relative h-full flex flex-col p-8 rounded-3xl transition-all duration-300 ${
          highlighted
            ? 'bg-white dark:bg-dark-900 border-2 border-purple-600 dark:border-primary-500 shadow-2xl shadow-purple-200 dark:shadow-primary-500/20'
            : 'bg-gray-50 dark:bg-dark-800 border border-gray-200 dark:border-dark-700 hover:border-purple-300 dark:hover:border-purple-400'
        }`}
      >
        <div className="mb-6">
          <Icon className="w-10 h-10 text-primary-400" aria-hidden />
        </div>

        <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">{plan.name}</h3>
        {copy && <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">{copy.subtitle}</p>}
        <p className="text-gray-600 dark:text-gray-400 text-xs mb-8">
          {number(plan.monthlyCredits)} credits included
          {perCredit ? ` (~${perCredit} per credit)` : ''}
        </p>

        <div className="mb-8">
          <div className="flex items-baseline">
            <span className="text-6xl font-black gradient-text">
              {money(plan.priceCentsMonthly)}
            </span>
            <span className="ml-2 text-gray-600 dark:text-gray-400">/month</span>
          </div>
        </div>

        <ul className="space-y-4 mb-8 flex-1">
          {planFeatures(plan).map((label) => (
            <li key={label} className="flex items-start space-x-3">
              <div className="mt-1 p-1 rounded-full bg-green-100 dark:bg-green-500/10">
                <Check className="w-4 h-4 text-green-500" aria-hidden />
              </div>
              <span className="text-sm text-gray-800 dark:text-gray-200">{label}</span>
            </li>
          ))}
        </ul>

        <Link
          to={ctaTo}
          aria-label={`Get started with ${plan.name}`}
          className={`group w-full py-4 rounded-xl font-bold transition-all duration-300 flex items-center justify-center space-x-2 ${
            highlighted
              ? 'bg-primary-500 text-white hover:bg-primary-600'
              : 'bg-white dark:bg-dark-800 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-700 border border-gray-300 dark:border-dark-600'
          }`}
        >
          <span>Get started</span>
          <ArrowRight
            className="w-5 h-5 group-hover:translate-x-1 transition-transform"
            aria-hidden
          />
        </Link>
      </div>
    </div>
  );
}

/** v1 Pricing, driven by `GET /plans` (F-01). Paid plans are cards; the free start is a note. */
export function Pricing() {
  const plansQuery = usePlans();
  const { data: me } = useMe();
  // Signed-in users pick a plan on the billing page; everyone else signs up first.
  const ctaTo = me ? '/app/billing' : '/register';

  const data = plansQuery.data;
  const paid = data?.plans.filter((p) => p.priceCentsMonthly > 0) ?? [];
  const signupBonus = data?.grants.signupBonus ?? 0;

  return (
    <section
      id="pricing"
      className="py-24 px-4 sm:px-6 lg:px-8 bg-white dark:bg-dark-950 relative overflow-hidden"
    >
      <div className="absolute inset-0" aria-hidden>
        <div className="absolute top-20 right-0 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-0 w-96 h-96 bg-accent-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto">
        <div className="text-center mb-12 sm:mb-16 lg:mb-20 space-y-4 sm:space-y-6 animate-slide-up">
          <div className="inline-flex items-center space-x-2 bg-purple-100 dark:bg-purple-500/10 px-4 py-2 rounded-full text-sm font-medium mb-4">
            <Sparkles className="w-4 h-4 text-purple-600" aria-hidden />
            <span className="text-gray-800 dark:text-purple-300">Flexible Pricing</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-gray-800 dark:text-white leading-tight">
            Choose Your
            <span className="gradient-text"> Plan</span>
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto px-4">
            Start free, upgrade when you&apos;re ready. No hidden fees, cancel anytime.
          </p>
        </div>

        {plansQuery.isPending ? (
          <div className="py-16">
            <Spinner label="Loading plans…" />
          </div>
        ) : plansQuery.isError ? (
          <div className="max-w-xl mx-auto">
            <ErrorState
              error={plansQuery.error}
              title="Could not load pricing"
              onRetry={() => void plansQuery.refetch()}
            />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 max-w-7xl mx-auto">
              {paid.map((plan) => (
                <PlanCard key={plan.tier} plan={plan} ctaTo={ctaTo} />
              ))}
            </div>

            {signupBonus > 0 && (
              <div className="mt-16 max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-3 text-center sm:text-left bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/30 rounded-2xl px-6 py-4">
                <Gift className="w-6 h-6 text-purple-600 shrink-0" aria-hidden />
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Not ready to pay? Every new account gets{' '}
                  <strong className="text-gray-900 dark:text-white">
                    {number(signupBonus)} free credits
                  </strong>{' '}
                  to try PromptVerse.{' '}
                  {!me && (
                    <Link
                      to="/register"
                      className="font-semibold text-action-600 hover:text-action-700 dark:text-action-500 dark:hover:text-action-400"
                    >
                      Create a free account
                    </Link>
                  )}
                </p>
              </div>
            )}
          </>
        )}

        <div className="text-center mt-10">
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center space-x-2">
              <Check className="w-5 h-5 text-green-400" aria-hidden />
              <span>No credit card required to start</span>
            </div>
            <div className="flex items-center space-x-2">
              <Check className="w-5 h-5 text-green-400" aria-hidden />
              <span>Cancel anytime</span>
            </div>
            <div className="flex items-center space-x-2">
              <Check className="w-5 h-5 text-green-400" aria-hidden />
              <span>Secure payments by Stripe</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
