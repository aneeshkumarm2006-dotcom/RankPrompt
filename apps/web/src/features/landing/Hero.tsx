import { PLATFORM_LABELS, PLATFORMS } from '@pv/shared';
import { ArrowRight, Sparkles, Star, TrendingUp, Zap, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router';
import { useMe } from '../../lib/api/auth';
import { usePlans } from '../../lib/api/meta';
import { number } from '../../lib/format';

/** Illustrative mock-up only (labelled "Example"): not live data and not a claim. */
const SAMPLE_ROWS: {
  name: string;
  rank: number;
  score: string;
  delta: string;
  icon: LucideIcon;
  tile: string;
  scoreClass: string;
  highlight?: boolean;
}[] = [
  {
    name: 'ChatGPT',
    rank: 1,
    score: '98%',
    delta: '+12%',
    icon: Zap,
    tile: 'from-primary-500 to-accent-500',
    scoreClass: 'text-green-500',
    highlight: true,
  },
  {
    name: 'Gemini',
    rank: 2,
    score: '92%',
    delta: '+8%',
    icon: Sparkles,
    tile: 'from-purple-500 to-pink-500',
    scoreClass: 'text-purple-600 dark:text-purple-400',
  },
  {
    name: 'Perplexity',
    rank: 3,
    score: '87%',
    delta: '+5%',
    icon: Star,
    tile: 'from-orange-500 to-yellow-500',
    scoreClass: 'text-gray-800 dark:text-white',
  },
];

const SAMPLE_TREND = [60, 72, 68, 85, 78, 92, 98];

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="space-y-1 sm:space-y-2">
      <div className="text-2xl sm:text-3xl md:text-4xl font-black gradient-text">{value}</div>
      <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">{label}</div>
    </div>
  );
}

function SampleDashboard() {
  return (
    <div className="relative animate-slide-left hidden lg:block" aria-hidden>
      <div className="absolute inset-0 bg-gradient-to-r from-primary-500/30 to-accent-500/30 rounded-3xl blur-3xl" />
      <div className="relative z-10 bg-white dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-2xl sm:rounded-3xl p-4 sm:p-6 space-y-3 sm:space-y-4 shadow-lg">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h3 className="text-gray-800 dark:text-white font-bold text-base sm:text-lg">
            Platform Rankings
          </h3>
          <div className="px-2 sm:px-3 py-0.5 sm:py-1 bg-green-100 dark:bg-green-500/10 rounded-full border border-green-200 dark:border-green-500/30">
            <span className="text-xs text-green-600 dark:text-green-400 font-semibold">
              Example
            </span>
          </div>
        </div>

        <div className="space-y-2 sm:space-y-3">
          {SAMPLE_ROWS.map((row) => (
            <div
              key={row.name}
              className={`bg-gray-50 dark:bg-dark-800 p-3 sm:p-4 rounded-lg sm:rounded-xl hover:bg-gray-100 dark:hover:bg-dark-700 transition-all duration-300 border ${
                row.highlight
                  ? 'border-purple-200 dark:border-purple-500/30'
                  : 'border-gray-200 dark:border-dark-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <div
                    className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br ${row.tile} flex items-center justify-center`}
                  >
                    <row.icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div>
                    <div className="font-bold text-gray-800 dark:text-white">{row.name}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Ranking #{row.rank}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-bold text-lg ${row.scoreClass}`}>{row.score}</div>
                  <div className="flex items-center space-x-1 text-xs text-green-500">
                    <TrendingUp className="w-3 h-3" />
                    <span>{row.delta}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 p-5 bg-gray-50 dark:bg-dark-800 rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-semibold text-gray-800 dark:text-white">
              Visibility Trend
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Last 7 runs</div>
          </div>
          <div className="h-32 flex items-end space-x-2">
            {SAMPLE_TREND.map((height, index) => (
              <div key={index} className="flex-1 group">
                <div
                  className="bg-gradient-to-t from-blue-500 to-purple-500 rounded-t-lg transition-all duration-300 group-hover:from-blue-400 group-hover:to-purple-400"
                  style={{ height: `${height * 0.9}px` }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary-500/30 rounded-full blur-3xl animate-pulse-slow" />
      <div
        className="absolute -bottom-10 -left-10 w-40 h-40 bg-accent-500/30 rounded-full blur-3xl animate-pulse-slow"
        style={{ animationDelay: '1.5s' }}
      />
    </div>
  );
}

/** v1 Hero. The made-up stats (50K+ queries, 10K+ brands) are replaced by facts (F-01). */
export function Hero() {
  const { data: me } = useMe();
  const { data: plans } = usePlans();
  const platformNames = PLATFORMS.map((p) => PLATFORM_LABELS[p]);

  return (
    <div className="relative pt-24 sm:pt-28 md:pt-32 pb-12 sm:pb-16 md:pb-20 px-4 sm:px-6 lg:px-8 bg-white dark:bg-dark-950 min-h-screen flex items-center overflow-hidden">
      <div className="absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary-500/20 rounded-full blur-3xl animate-float" />
        <div
          className="absolute bottom-20 right-10 w-96 h-96 bg-accent-500/20 rounded-full blur-3xl animate-float"
          style={{ animationDelay: '2s' }}
        />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-primary-400/10 rounded-full blur-3xl animate-pulse-slow" />
      </div>

      <div className="relative max-w-7xl mx-auto w-full">
        <div className="grid lg:grid-cols-2 gap-8 sm:gap-12 lg:gap-16 items-center">
          <div className="space-y-6 sm:space-y-8 animate-slide-right">
            <div className="inline-flex items-center space-x-2 bg-purple-100 dark:bg-purple-500/10 px-5 py-2.5 rounded-full text-sm font-medium animate-slide-down">
              <Sparkles className="w-4 h-4 text-purple-600" aria-hidden />
              <span className="text-gray-800 dark:text-purple-300">
                AI-Powered Brand Visibility
              </span>
              <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" aria-hidden />
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black leading-[1.1] tracking-tight">
              <span className="text-gray-800 dark:text-white">Dominate</span>
              <br />
              <span className="gradient-text">AI Search</span>
              <br />
              <span className="text-gray-600 dark:text-gray-400">Rankings</span>
            </h1>

            <p className="text-base sm:text-lg md:text-xl text-gray-600 dark:text-gray-400 leading-relaxed max-w-xl">
              Monitor your brand across {platformNames.slice(0, -1).join(', ')} and{' '}
              {platformNames.at(-1)}. See where you are mentioned, how you rank and which sources
              the AI cites, then track how it changes over time.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Link
                to={me ? '/app/brands/new' : '/register'}
                className="bg-primary-500 text-white px-8 py-4 rounded-2xl font-bold hover:bg-primary-600 transition-all duration-300 flex items-center justify-center space-x-2 group"
              >
                <span>{me ? 'Start New Analysis' : 'Start Free Analysis'}</span>
                <ArrowRight
                  className="w-5 h-5 group-hover:translate-x-2 transition-transform"
                  aria-hidden
                />
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-4 sm:gap-6 md:gap-8 pt-8 sm:pt-10 md:pt-12">
              <Stat value={String(PLATFORMS.length)} label="AI Platforms" />
              {plans && plans.grants.signupBonus > 0 && (
                <Stat value={number(plans.grants.signupBonus)} label="Free Credits at Signup" />
              )}
              <Stat value="$0" label="To Get Started" />
            </div>
          </div>

          <SampleDashboard />
        </div>
      </div>
    </div>
  );
}
