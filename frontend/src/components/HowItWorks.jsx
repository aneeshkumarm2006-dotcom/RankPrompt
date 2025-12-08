import { Search, BarChart2, Lightbulb, Rocket, CheckCircle2, ArrowRight } from 'lucide-react';

const steps = [
  {
    icon: Search,
    title: 'Connect & Scan',
    description: 'Enter your brand details and watch as we scan across ChatGPT, Gemini, Claude, and more AI platforms.',
    number: '01',
    color: 'from-primary-500 to-orange-500',
  },
  {
    icon: BarChart2,
    title: 'Analyze Deep',
    description: 'Get comprehensive reports on rankings, visibility scores, sentiment analysis, and competitor insights.',
    number: '02',
    color: 'from-purple-500 to-pink-500',
  },
  {
    icon: Lightbulb,
    title: 'Optimize Smart',
    description: 'Receive AI-powered recommendations for schema, content, and citations to boost your rankings.',
    number: '03',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    icon: Rocket,
    title: 'Scale & Grow',
    description: 'Monitor improvements in real-time and dominate AI search results across all major platforms.',
    number: '04',
    color: 'from-green-500 to-emerald-500',
  },
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="py-24 px-4 sm:px-6 lg:px-8 bg-gray-50 relative overflow-hidden">
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(rgba(249, 115, 22, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(249, 115, 22, 0.1) 1px, transparent 1px)',
          backgroundSize: '50px 50px'
        }} />
      </div>

      <div className="relative max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-12 sm:mb-16 lg:mb-20 space-y-4 sm:space-y-6 animate-slide-up">
          <div className="inline-flex items-center space-x-2 bg-purple-100 px-4 py-2 rounded-full text-sm font-medium mb-4">
            <CheckCircle2 className="w-4 h-4 text-purple-600" />
            <span className="text-gray-800">Simple Process</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-gray-800 leading-tight">
            How It
            <span className="gradient-text"> Works</span>
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-gray-600 max-w-2xl mx-auto px-4">
            Get started in minutes and watch your AI search rankings soar
          </p>
        </div>

        {/* Steps Timeline */}
        <div className="relative">
          {/* Connection Line */}
          <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-1 bg-gradient-to-r from-primary-500 via-purple-500 to-green-500 opacity-20 transform -translate-y-1/2"></div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {steps.map((step, index) => (
              <div key={index} className="relative group">
                <div className="relative text-center space-y-3 sm:space-y-4">
                  {/* Number Badge with Glow */}
                  <div className="relative inline-flex mb-4 sm:mb-6">
                    <div className={`absolute inset-0 bg-gradient-to-r ${step.color} rounded-full blur-xl opacity-50 group-hover:opacity-100 transition-opacity`}></div>
                    <div className={`relative flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-r ${step.color} text-white text-2xl sm:text-3xl font-black shadow-2xl`}>
                      {step.number}
                    </div>
                  </div>
                  
                  {/* Icon Card */}
                  <div className="flex justify-center mb-4 sm:mb-6">
                    <div className="relative">
                      <div className={`absolute inset-0 bg-gradient-to-r ${step.color} rounded-2xl blur opacity-30 group-hover:opacity-50 transition-opacity`}></div>
                      <div className={`relative bg-white p-4 sm:p-5 rounded-xl sm:rounded-2xl group-hover:scale-110 transition-transform duration-300`}>
                        <step.icon className="w-8 h-8 sm:w-10 sm:h-10 text-purple-600" />
                      </div>
                    </div>
                  </div>
                  
                  {/* Content */}
                  <h3 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2 sm:mb-3 group-hover:gradient-text transition-all">
                    {step.title}
                  </h3>
                  
                  <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-12 sm:mt-16 lg:mt-20">
          <button className="bg-[#4F46E5] text-white px-6 sm:px-8 md:px-10 py-3 sm:py-4 md:py-5 rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg hover:bg-purple-700 transition-all duration-300 flex items-center justify-center space-x-2 sm:space-x-3">
            <span>Start Your Free Trial</span>
            <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6 group-hover:translate-x-2 transition-transform" />
          </button>
          <p className="text-gray-600 text-xs sm:text-sm mt-3 sm:mt-4">No credit card required • 14-day free trial</p>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
