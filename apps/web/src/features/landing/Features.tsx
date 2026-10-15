import {
  BarChart3,
  CalendarClock,
  Eye,
  Link2,
  Search,
  Shield,
  Target,
  type LucideIcon,
} from 'lucide-react';

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
  /** Tailwind gradient for the icon tile. */
  color: string;
  /** Glow colour behind the icon (v1 derived it from the gradient name). */
  glow: string;
}

/**
 * v1 feature grid. Claims the product doesn't back up ("Instant Alerts", "AI-powered
 * recommendations") are replaced with what v2 actually does (F-01).
 */
const FEATURES: Feature[] = [
  {
    icon: Search,
    title: 'AI Prompt Scanning',
    description:
      'Discover which questions and prompts mention your brand across ChatGPT, Gemini, Claude, Perplexity and Google AI Overviews.',
    color: 'from-primary-500 to-accent-500',
    glow: '#F45A2F',
  },
  {
    icon: Eye,
    title: 'Visibility Tracking',
    description:
      'Track mentions, rank and citations for your brand on every prompt and platform, run after run.',
    color: 'from-purple-500 to-pink-500',
    glow: '#a855f7',
  },
  {
    icon: Link2,
    title: 'Citations & Sources',
    description:
      'See which domains and pages AI assistants cite in their answers, and how often your own site is one of them.',
    color: 'from-green-500 to-emerald-500',
    glow: '#10b981',
  },
  {
    icon: BarChart3,
    title: 'Advanced Analytics',
    description:
      'Visibility by platform and category, trends over time, and reports you can share or export to PDF and Excel.',
    color: 'from-blue-500 to-cyan-500',
    glow: '#3b82f6',
  },
  {
    icon: Target,
    title: 'Competitor Intel',
    description:
      'Benchmark against competitors with share of voice and per-prompt ranks, and spot new competitors the AI recommends.',
    color: 'from-orange-500 to-yellow-500',
    glow: '#f97316',
  },
  {
    icon: CalendarClock,
    title: 'Scheduled Runs',
    description:
      'Re-run your prompts automatically every day, week or month and watch your visibility trend build up.',
    color: 'from-red-500 to-pink-500',
    glow: '#ef4444',
  },
];

export function Features() {
  return (
    <section
      id="features"
      className="py-24 px-4 sm:px-6 lg:px-8 bg-white dark:bg-dark-950 relative overflow-hidden"
    >
      <div className="absolute inset-0" aria-hidden>
        <div className="absolute top-40 left-0 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-40 right-0 w-96 h-96 bg-accent-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto">
        <div className="text-center mb-12 sm:mb-16 lg:mb-20 space-y-4 sm:space-y-6 animate-slide-up">
          <div className="inline-flex items-center space-x-2 bg-purple-100 dark:bg-purple-500/10 px-4 py-2 rounded-full text-sm font-medium mb-4">
            <Shield className="w-4 h-4 text-purple-600" aria-hidden />
            <span className="text-gray-800 dark:text-purple-300">Powerful Features</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-gray-800 dark:text-white leading-tight">
            Everything You Need to
            <span className="block gradient-text mt-1 sm:mt-2">Dominate AI Search</span>
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto leading-relaxed px-4">
            Tools to measure, track and improve your brand&apos;s presence in AI-generated answers
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="group bg-gray-50 dark:bg-dark-900 rounded-xl sm:rounded-2xl p-6 sm:p-8 card-hover border border-gray-200 dark:border-dark-700"
            >
              <div className="relative mb-4 sm:mb-6 flex justify-center">
                <div
                  aria-hidden
                  className="absolute inset-0 rounded-xl sm:rounded-2xl blur-xl opacity-75 group-hover:opacity-100 transition-opacity"
                  style={{
                    background: `radial-gradient(circle, ${feature.glow} 0%, transparent 70%)`,
                  }}
                />
                <div
                  className={`relative flex p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-r ${feature.color}`}
                >
                  <feature.icon className="w-6 h-6 sm:w-8 sm:h-8 text-white" aria-hidden />
                </div>
              </div>

              <h3 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white mb-2 sm:mb-3 text-center group-hover:gradient-text transition-all">
                {feature.title}
              </h3>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 text-center leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
