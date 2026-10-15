import { ArrowRight, Gift, Sparkles, Star, Zap } from 'lucide-react';
import { Link } from 'react-router';
import { useMe } from '../../lib/api/auth';
import { usePlans } from '../../lib/api/meta';
import { number } from '../../lib/format';

/**
 * v1 CTA. The unbacked claims ("Join 10,000+ brands", "4.9/5 rating", "14-day free trial",
 * "Limited Time Offer") are gone (F-01); the free credits come from `GET /plans`.
 */
export function CTA() {
  const { data: me } = useMe();
  const { data: plans } = usePlans();
  const bonus = plans?.grants.signupBonus ?? 0;

  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-purple-50 to-indigo-100 dark:from-dark-800 dark:to-dark-950 relative overflow-hidden">
      <div className="absolute inset-0" aria-hidden>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full h-full max-w-4xl">
          <div className="absolute inset-0 bg-gradient-to-r from-primary-500/20 to-accent-500/20 rounded-full blur-3xl animate-pulse-slow" />
        </div>
      </div>

      <div className="relative max-w-5xl mx-auto">
        <div className="relative bg-white dark:bg-dark-900 rounded-2xl sm:rounded-3xl p-6 sm:p-10 lg:p-16 text-center border border-gray-200 dark:border-dark-700 overflow-hidden shadow-lg">
          <div className="absolute inset-0 opacity-5 dark:opacity-10" aria-hidden>
            <div
              className="absolute inset-0"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 2px 2px, rgba(249,115,22,0.5) 2px, transparent 0)',
                backgroundSize: '50px 50px',
              }}
            />
          </div>

          <div className="relative z-10 space-y-6 sm:space-y-8">
            <div className="inline-flex items-center space-x-2 bg-purple-100 dark:bg-purple-500/10 px-5 py-2.5 rounded-full text-sm font-medium">
              <Zap className="w-4 h-4 text-purple-600" aria-hidden />
              <span className="text-gray-800 dark:text-purple-300">Free to Start</span>
              <Sparkles className="w-4 h-4 text-indigo-600" aria-hidden />
            </div>

            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-gray-800 dark:text-white leading-tight">
              Ready to
              <span className="gradient-text block mt-1 sm:mt-2">Dominate AI Search?</span>
            </h2>

            <p className="text-base sm:text-lg md:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed px-4">
              Find out how AI assistants talk about your brand today.
              {bonus > 0 ? ` Sign up and get ${number(bonus)} free credits.` : ''} No credit card
              required.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center pt-4 sm:pt-6">
              <Link
                to={me ? '/app/brands/new' : '/register'}
                className="group bg-[#4F46E5] text-white px-6 sm:px-8 md:px-10 py-3 sm:py-4 md:py-5 rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg hover:bg-purple-700 transition-all duration-300 flex items-center justify-center space-x-2 sm:space-x-3"
              >
                <span>{me ? 'Start a New Analysis' : 'Get Started Free'}</span>
                <ArrowRight
                  className="w-5 h-5 sm:w-6 sm:h-6 group-hover:translate-x-2 transition-transform"
                  aria-hidden
                />
              </Link>
            </div>

            <div className="pt-6 sm:pt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-xs text-gray-600 dark:text-gray-400">
              <div className="flex items-center space-x-1">
                <Sparkles className="w-4 h-4 text-primary-400" aria-hidden />
                <span>No credit card</span>
              </div>
              {bonus > 0 && (
                <>
                  <div className="h-4 w-px bg-gray-300 dark:bg-dark-600" aria-hidden />
                  <div className="flex items-center space-x-1">
                    <Gift className="w-4 h-4 text-primary-400" aria-hidden />
                    <span>{number(bonus)} free credits</span>
                  </div>
                </>
              )}
              <div className="h-4 w-px bg-gray-300 dark:bg-dark-600" aria-hidden />
              <div className="flex items-center space-x-1">
                <Star className="w-4 h-4 text-primary-400" aria-hidden />
                <span>Cancel anytime</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
