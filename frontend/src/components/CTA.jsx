import { ArrowRight, Sparkles, Zap, Star } from 'lucide-react';

const CTA = () => {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 gradient-bg relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full h-full max-w-4xl">
          <div className="absolute inset-0 bg-gradient-to-r from-primary-500/20 to-accent-500/20 rounded-full blur-3xl animate-pulse-slow"></div>
        </div>
      </div>

      <div className="relative max-w-5xl mx-auto">
        <div className="relative glass-effect rounded-2xl sm:rounded-3xl p-6 sm:p-10 lg:p-16 text-center border border-white/10 overflow-hidden">
          {/* Animated Background Pattern */}
          <div className="absolute inset-0 opacity-5">
            <div className="absolute inset-0" style={{
              backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(249,115,22,0.5) 2px, transparent 0)',
              backgroundSize: '50px 50px',
            }} />
          </div>

          {/* Content */}
          <div className="relative z-10 space-y-6 sm:space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center space-x-2 glass-light px-5 py-2.5 rounded-full text-sm font-medium animate-bounce-slow">
              <Zap className="w-4 h-4 text-primary-400" />
              <span className="text-gray-200">Limited Time Offer</span>
              <Sparkles className="w-4 h-4 text-accent-400" />
            </div>

            {/* Heading */}
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white leading-tight">
              Ready to
              <span className="gradient-text block mt-1 sm:mt-2">
                Dominate AI Search?
              </span>
            </h2>

            {/* Description */}
            <p className="text-base sm:text-lg md:text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed px-4">
              Join 10,000+ brands already tracking and optimizing their AI search presence. 
              Start free, no credit card required.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center pt-4 sm:pt-6">
              <button className="group relative">
                <div className="absolute inset-0 bg-gradient-to-r from-primary-500 to-accent-500 rounded-2xl blur-xl opacity-75 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative bg-gradient-to-r from-primary-500 to-accent-500 text-white px-6 sm:px-8 md:px-10 py-3 sm:py-4 md:py-5 rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg hover:shadow-2xl hover:shadow-primary-500/50 transition-all duration-300 flex items-center justify-center space-x-2 sm:space-x-3">
                  <span>Start Free Trial</span>
                  <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6 group-hover:translate-x-2 transition-transform" />
                </div>
              </button>
              <button className="glass-light text-white px-6 sm:px-8 md:px-10 py-3 sm:py-4 md:py-5 rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg hover:bg-white/10 transition-all duration-300 border border-white/20">
                Schedule Demo
              </button>
            </div>

            {/* Social Proof */}
            <div className="pt-8 sm:pt-12 flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-8 text-xs sm:text-sm">
              <div className="flex items-center space-x-3">
                <div className="flex -space-x-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 border-2 border-dark-900" />
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 border-2 border-dark-900" />
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-pink-600 border-2 border-dark-900" />
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 border-2 border-dark-900 flex items-center justify-center text-xs font-bold text-white">
                    +10K
                  </div>
                </div>
                <span className="text-gray-300 font-semibold">Trusted by thousands</span>
              </div>
              <div className="flex items-center space-x-2 text-gray-300">
                <div className="flex space-x-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <span className="font-semibold">4.9/5 rating</span>
              </div>
            </div>

            {/* Trust Badges */}
            <div className="pt-6 sm:pt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-xs text-gray-400">
              <div className="flex items-center space-x-1">
                <Sparkles className="w-4 h-4 text-primary-400" />
                <span>No credit card</span>
              </div>
              <div className="h-4 w-px bg-gray-600"></div>
              <div className="flex items-center space-x-1">
                <Zap className="w-4 h-4 text-primary-400" />
                <span>14-day free trial</span>
              </div>
              <div className="h-4 w-px bg-gray-600"></div>
              <div className="flex items-center space-x-1">
                <Star className="w-4 h-4 text-primary-400" />
                <span>Cancel anytime</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTA;
