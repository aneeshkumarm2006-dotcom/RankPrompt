import { ArrowRight, Sparkles, Star, TrendingUp, Zap, Play } from 'lucide-react';

const Hero = () => {
  return (
    <div className="relative pt-24 sm:pt-28 md:pt-32 pb-12 sm:pb-16 md:pb-20 px-4 sm:px-6 lg:px-8 bg-white dark:bg-dark-950 min-h-screen flex items-center overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary-500/20 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent-500/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-primary-400/10 rounded-full blur-3xl animate-pulse-slow"></div>
      </div>

      <div className="relative max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-8 sm:gap-12 lg:gap-16 items-center">
          {/* Left Content */}
          <div className="space-y-6 sm:space-y-8 animate-slide-right">
            {/* Badge */}
            <div className="inline-flex items-center space-x-2 bg-purple-100 dark:bg-purple-500/10 px-5 py-2.5 rounded-full text-sm font-medium animate-slide-down">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span className="text-gray-800 dark:text-purple-300">AI-Powered Brand Visibility</span>
              <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
            </div>
            
            {/* Heading */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black leading-[1.1] tracking-tight">
              <span className="text-gray-800 dark:text-white">Dominate</span>
              <br />
              <span className="gradient-text">AI Search</span>
              <br />
              <span className="text-gray-600 dark:text-gray-400">Rankings</span>
            </h1>
            
            {/* Description */}
            <p className="text-base sm:text-lg md:text-xl text-gray-600 dark:text-gray-400 leading-relaxed max-w-xl">
              Monitor your brand across ChatGPT, Gemini, Claude & more. Get real-time insights 
              and climb the AI rankings with data-driven optimization.
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <button className="bg-primary-500 text-white px-8 py-4 rounded-2xl font-bold hover:bg-primary-600 transition-all duration-300 flex items-center justify-center space-x-2">
                <span>Start Free Analysis</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
              </button>
              <button className="bg-gray-100 dark:bg-dark-800 text-gray-800 dark:text-gray-200 px-8 py-4 rounded-2xl font-semibold hover:bg-gray-200 dark:hover:bg-dark-700 transition-all duration-300 flex items-center justify-center space-x-2 group">
                <Play className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span>Watch Demo</span>
              </button>
            </div>
            
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 sm:gap-6 md:gap-8 pt-8 sm:pt-10 md:pt-12">
              <div className="space-y-1 sm:space-y-2">
                <div className="text-2xl sm:text-3xl md:text-4xl font-black gradient-text">50K+</div>
                <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Queries Tracked</div>
              </div>
              <div className="space-y-1 sm:space-y-2">
                <div className="text-2xl sm:text-3xl md:text-4xl font-black gradient-text">10K+</div>
                <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Brands Analyzed</div>
              </div>
              <div className="space-y-1 sm:space-y-2">
                <div className="text-2xl sm:text-3xl md:text-4xl font-black gradient-text">4+</div>
                <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">AI Platforms</div>
              </div>
            </div>
          </div>
          
          {/* Right Content - Dashboard Visual */}
          <div className="relative animate-slide-left hidden lg:block">
            {/* Glow Effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-primary-500/30 to-accent-500/30 rounded-3xl blur-3xl"></div>
            
            {/* Main Card */}
            <div className="relative z-10 bg-white dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-2xl sm:rounded-3xl p-4 sm:p-6 space-y-3 sm:space-y-4 shadow-lg">
              {/* Header */}
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <h3 className="text-gray-800 dark:text-white font-bold text-base sm:text-lg">Live Rankings</h3>
                <div className="px-2 sm:px-3 py-0.5 sm:py-1 bg-green-100 dark:bg-green-500/10 rounded-full border border-green-200 dark:border-green-500/30">
                  <span className="text-xs text-green-600 dark:text-green-400 font-semibold">● LIVE</span>
                </div>
              </div>

              {/* Ranking Cards */}
              <div className="space-y-2 sm:space-y-3">
                {/* Card 1 */}
                <div className="bg-gray-50 dark:bg-dark-800 p-3 sm:p-4 rounded-lg sm:rounded-xl hover:bg-gray-100 dark:hover:bg-dark-700 transition-all duration-300 group border border-purple-200 dark:border-purple-500/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 sm:space-x-3">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
                        <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                      </div>
                      <div>
                        <div className="font-bold text-gray-800 dark:text-white">ChatGPT</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Ranking #1</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-green-500 font-bold text-lg">98%</div>
                      <div className="flex items-center space-x-1 text-xs text-green-500">
                        <TrendingUp className="w-3 h-3" />
                        <span>+12%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card 2 */}
                <div className="bg-gray-50 dark:bg-dark-800 p-4 rounded-xl hover:bg-gray-100 dark:hover:bg-dark-700 transition-all duration-300 group border border-gray-200 dark:border-dark-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                        <Sparkles className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <div className="font-bold text-gray-800 dark:text-white">Gemini</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Ranking #2</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-purple-600 dark:text-purple-400 font-bold text-lg">92%</div>
                      <div className="flex items-center space-x-1 text-xs text-green-500">
                        <TrendingUp className="w-3 h-3" />
                        <span>+8%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card 3 */}
                <div className="bg-gray-50 dark:bg-dark-800 p-4 rounded-xl hover:bg-gray-100 dark:hover:bg-dark-700 transition-all duration-300 group border border-gray-200 dark:border-dark-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center">
                        <Star className="w-6 h-6 text-white fill-white" />
                      </div>
                      <div>
                        <div className="font-bold text-gray-800 dark:text-white">Claude</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Ranking #3</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-gray-800 dark:text-white font-bold text-lg">87%</div>
                      <div className="flex items-center space-x-1 text-xs text-green-500">
                        <TrendingUp className="w-3 h-3" />
                        <span>+5%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Chart Visualization */}
              <div className="mt-6 p-5 bg-gray-50 dark:bg-dark-800 rounded-xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm font-semibold text-gray-800 dark:text-white">Visibility Trend</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Last 7 days</div>
                </div>
                <div className="h-32 flex items-end space-x-2">
                  {[60, 72, 68, 85, 78, 92, 98].map((height, index) => (
                    <div key={index} className="flex-1 group cursor-pointer">
                      <div
                        className="bg-gradient-to-t from-primary-500 to-accent-500 rounded-t-lg transition-all duration-300 group-hover:from-primary-400 group-hover:to-accent-400"
                        style={{ height: `${height}%` }}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-2">
                  <span>Mon</span>
                  <span>Sun</span>
                </div>
              </div>
            </div>
            
            {/* Floating Accent Elements */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary-500/30 rounded-full blur-3xl animate-pulse-slow" />
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-accent-500/30 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1.5s' }} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Hero;
