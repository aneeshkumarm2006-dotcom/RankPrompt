import { Search, Target, TrendingUp, BarChart3, Settings, Zap, Eye, Shield } from 'lucide-react';

const features = [
  {
    icon: Search,
    title: 'AI Prompt Scanning',
    description: 'Discover which questions and prompts mention your brand across ChatGPT, Gemini, Claude, and more AI platforms.',
    color: 'from-primary-500 to-accent-500',
    style: 'featured',
  },
  {
    icon: Eye,
    title: 'Real-time Monitoring',
    description: 'Track your brand mentions and visibility scores in real-time across all major AI assistants.',
    color: 'from-purple-500 to-pink-500',
    style: 'standard',
  },
  {
    icon: TrendingUp,
    title: 'Smart Optimization',
    description: 'Get AI-powered recommendations for schema markup, citations, and content to boost rankings.',
    color: 'from-green-500 to-emerald-500',
    style: 'standard',
  },
  {
    icon: BarChart3,
    title: 'Advanced Analytics',
    description: 'Deep dive into comprehensive analytics and track your AI search performance over time.',
    color: 'from-blue-500 to-cyan-500',
    style: 'standard',
  },
  {
    icon: Target,
    title: 'Competitor Intel',
    description: 'Benchmark against competitors and discover opportunities to outrank them in AI responses.',
    color: 'from-orange-500 to-yellow-500',
    style: 'standard',
  },
  {
    icon: Zap,
    title: 'Instant Alerts',
    description: 'Get notified immediately when your rankings change or new brand mentions appear.',
    color: 'from-red-500 to-pink-500',
    style: 'standard',
  },
];

const Features = () => {
  return (
    <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 bg-white dark:bg-dark-950 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0">
        <div className="absolute top-40 left-0 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-40 right-0 w-96 h-96 bg-accent-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-12 sm:mb-16 lg:mb-20 space-y-4 sm:space-y-6 animate-slide-up">
          <div className="inline-flex items-center space-x-2 bg-purple-100 dark:bg-purple-500/10 px-4 py-2 rounded-full text-sm font-medium mb-4">
            <Shield className="w-4 h-4 text-purple-600" />
            <span className="text-gray-800 dark:text-purple-300">Powerful Features</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-gray-800 dark:text-white leading-tight">
            Everything You Need to
            <span className="block gradient-text mt-1 sm:mt-2">
              Dominate AI Search
            </span>
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto leading-relaxed px-4">
            Comprehensive suite of tools to measure, track, and optimize your brand's presence in AI-generated answers
          </p>
        </div>

        {/* Features Grid with Varied Designs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group bg-gray-50 dark:bg-dark-900 rounded-xl sm:rounded-2xl p-6 sm:p-8 card-hover border border-gray-200 dark:border-dark-700"
            >
              {/* Icon */}
              <div className="relative mb-4 sm:mb-6 flex justify-center">
                <div 
                  className="absolute inset-0 rounded-xl sm:rounded-2xl blur-xl opacity-75 group-hover:opacity-100 transition-opacity"
                  style={{
                    background: `radial-gradient(circle, ${feature.color.includes('primary') ? '#F45A2F' : feature.color.includes('accent') ? '#ec4899' : feature.color.includes('purple') ? '#a855f7' : feature.color.includes('pink') ? '#ec4899' : feature.color.includes('green') ? '#10b981' : feature.color.includes('emerald') ? '#10b981' : feature.color.includes('blue') ? '#3b82f6' : feature.color.includes('cyan') ? '#06b6d4' : feature.color.includes('orange') ? '#f97316' : feature.color.includes('yellow') ? '#eab308' : feature.color.includes('red') ? '#ef4444' : '#8b5cf6'} 0%, transparent 70%)`
                  }}
                ></div>
                <div className={`relative flex p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-r ${feature.color}`}>
                  <feature.icon className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                </div>
              </div>
              
              {/* Content */}
              <h3 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white mb-2 sm:mb-3 text-center group-hover:gradient-text transition-all">
                {feature.title}
              </h3>
              
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 text-center leading-relaxed mb-4 sm:mb-6">
                {feature.description}
              </p>
              
              {/* Hover Arrow */}
              <div className="flex items-center space-x-2 text-purple-600 dark:text-purple-400 text-sm sm:text-base font-semibold opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                <span>Explore feature</span>
                <span className="group-hover:translate-x-2 transition-transform">→</span>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        {/* <div className="mt-12 sm:mt-16 text-center">
          <button className="bg-primary-500 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-xl sm:rounded-2xl font-semibold hover:bg-primary-600 transition-all flex items-center justify-center space-x-2 text-sm sm:text-base">
            <span>View All Features</span>
            <Zap className="w-5 h-5 group-hover:rotate-12 transition-transform" />
          </button>
        </div> */}
      </div>
    </section>
  );
};

export default Features;
