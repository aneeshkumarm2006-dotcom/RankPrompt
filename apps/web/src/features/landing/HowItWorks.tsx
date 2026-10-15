import { BarChart2, CheckCircle2, Lightbulb, Rocket, Search, type LucideIcon } from 'lucide-react';

interface Step {
  icon: LucideIcon;
  title: string;
  description: string;
  number: string;
  color: string;
}

/** v1 steps; "sentiment analysis" and "AI-powered recommendations" are not features, so dropped. */
const STEPS: Step[] = [
  {
    icon: Search,
    title: 'Connect & Scan',
    description:
      'Enter your brand and website. We suggest categories and prompts, then ask ChatGPT, Gemini, Claude and more.',
    number: '01',
    color: 'from-primary-500 to-orange-500',
  },
  {
    icon: BarChart2,
    title: 'Analyze Deep',
    description:
      'Get reports on mentions, rankings, visibility scores, cited sources and how your competitors compare.',
    number: '02',
    color: 'from-purple-500 to-pink-500',
  },
  {
    icon: Lightbulb,
    title: 'Optimize Smart',
    description:
      'Find the prompts where you are missing and the sources the AI trusts, and focus your content there.',
    number: '03',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    icon: Rocket,
    title: 'Scale & Grow',
    description:
      'Schedule runs to track your progress over time across all the major AI platforms.',
    number: '04',
    color: 'from-green-500 to-emerald-500',
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="py-24 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-dark-950 relative overflow-hidden"
    >
      <div className="absolute inset-0 opacity-20" aria-hidden>
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(rgba(249, 115, 22, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(249, 115, 22, 0.1) 1px, transparent 1px)',
            backgroundSize: '50px 50px',
          }}
        />
      </div>

      <div className="relative max-w-7xl mx-auto">
        <div className="text-center mb-12 sm:mb-16 lg:mb-20 space-y-4 sm:space-y-6 animate-slide-up">
          <div className="inline-flex items-center space-x-2 bg-purple-100 dark:bg-purple-500/10 px-4 py-2 rounded-full text-sm font-medium mb-4">
            <CheckCircle2 className="w-4 h-4 text-purple-600" aria-hidden />
            <span className="text-gray-800 dark:text-purple-300">Simple Process</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-gray-800 dark:text-white leading-tight">
            How It
            <span className="gradient-text"> Works</span>
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto px-4">
            Get started in minutes and see where your brand stands in AI search
          </p>
        </div>

        <div className="relative">
          <div
            aria-hidden
            className="hidden lg:block absolute top-1/2 left-0 right-0 h-1 bg-gradient-to-r from-primary-500 via-purple-500 to-green-500 opacity-20 transform -translate-y-1/2"
          />
          <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {STEPS.map((step) => (
              <li key={step.number} className="relative group">
                <div className="relative text-center space-y-3 sm:space-y-4">
                  <div className="relative inline-flex mb-4 sm:mb-6">
                    <div
                      aria-hidden
                      className={`absolute inset-0 bg-gradient-to-r ${step.color} rounded-full blur-xl opacity-50 group-hover:opacity-100 transition-opacity`}
                    />
                    <div
                      className={`relative flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-r ${step.color} text-white text-2xl sm:text-3xl font-black shadow-2xl`}
                    >
                      {step.number}
                    </div>
                  </div>

                  <div className="flex justify-center mb-4 sm:mb-6">
                    <div className="relative">
                      <div
                        aria-hidden
                        className={`absolute inset-0 bg-gradient-to-r ${step.color} rounded-2xl blur opacity-30 group-hover:opacity-50 transition-opacity`}
                      />
                      <div className="relative bg-white dark:bg-dark-800 p-4 sm:p-5 rounded-xl sm:rounded-2xl group-hover:scale-110 transition-transform duration-300">
                        <step.icon
                          className="w-8 h-8 sm:w-10 sm:h-10 text-purple-600"
                          aria-hidden
                        />
                      </div>
                    </div>
                  </div>

                  <h3 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white mb-2 sm:mb-3 group-hover:gradient-text transition-all">
                    {step.title}
                  </h3>
                  <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
