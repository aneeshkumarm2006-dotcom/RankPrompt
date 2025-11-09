import { Check, Sparkles, Crown, Zap, ArrowRight } from 'lucide-react';

const plans = [
  {
    name: 'Starter',
    price: '0',
    description: 'Perfect for trying out RankPrompt',
    features: [
      '5 brand scans per month',
      '2 AI platforms tracked',
      'Basic analytics',
      'Email support',
      '7-day data history',
    ],
    cta: 'Start Free',
    popular: false,
  },
  {
    name: 'Professional',
    price: '49',
    description: 'For growing businesses',
    features: [
      'Unlimited brand scans',
      'All AI platforms tracked',
      'Advanced analytics & reports',
      'Priority support',
      'Unlimited data history',
      'Competitor tracking',
      'API access',
      'Custom alerts',
    ],
    cta: 'Get Started',
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    description: 'For large organizations',
    features: [
      'Everything in Professional',
      'Multiple team members',
      'White-label reports',
      'Dedicated account manager',
      'Custom integrations',
      'SLA guarantee',
      'Training & onboarding',
    ],
    cta: 'Contact Sales',
    popular: false,
  },
];

const Pricing = () => {
  return (
    <section id="pricing" className="py-24 px-4 sm:px-6 lg:px-8 bg-dark-900 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0">
        <div className="absolute top-20 right-0 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 left-0 w-96 h-96 bg-accent-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-12 sm:mb-16 lg:mb-20 space-y-4 sm:space-y-6 animate-slide-up">
          <div className="inline-flex items-center space-x-2 glass-light px-4 py-2 rounded-full text-sm font-medium mb-4">
            <Sparkles className="w-4 h-4 text-primary-400" />
            <span className="text-gray-300">Flexible Pricing</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white leading-tight">
            Choose Your
            <span className="gradient-text"> Plan</span>
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-gray-400 max-w-2xl mx-auto px-4">
            Start free, upgrade when you're ready. No hidden fees, cancel anytime.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 max-w-7xl mx-auto">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`relative group ${
                plan.popular ? 'md:scale-105' : ''
              }`}
            >
              {/* Popular Badge */}
              {plan.popular && (
                <div className="absolute -top-5 left-1/2 transform -translate-x-1/2 z-20">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary-500 to-accent-500 rounded-full blur"></div>
                    <div className="relative bg-gradient-to-r from-primary-500 to-accent-500 text-white px-6 py-2 rounded-full text-sm font-bold flex items-center space-x-1">
                      <Crown className="w-4 h-4" />
                      <span>Most Popular</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Card */}
              <div
                className={`relative h-full p-8 rounded-3xl transition-all duration-300 ${
                  plan.popular
                    ? 'glass-effect border-2 border-primary-500/50 shadow-2xl shadow-primary-500/20'
                    : 'glass-effect border border-white/10 hover:border-primary-500/30'
                }`}
              >
                {/* Icon */}
                <div className="mb-6">
                  {index === 0 && <Zap className="w-10 h-10 text-primary-400" />}
                  {index === 1 && <Crown className="w-10 h-10 text-primary-400" />}
                  {index === 2 && <Sparkles className="w-10 h-10 text-primary-400" />}
                </div>

                {/* Plan Name */}
                <h3 className="text-2xl font-bold text-white mb-2">
                  {plan.name}
                </h3>
                <p className="text-gray-400 text-sm mb-8">
                  {plan.description}
                </p>

                {/* Price */}
                <div className="mb-8">
                  <div className="flex items-baseline">
                    {plan.price !== 'Custom' && (
                      <span className="text-3xl font-bold text-gray-400">$</span>
                    )}
                    <span className="text-6xl font-black gradient-text">
                      {plan.price}
                    </span>
                    {plan.price !== 'Custom' && (
                      <span className="ml-2 text-gray-400">/month</span>
                    )}
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start space-x-3">
                      <div className="mt-1 p-1 rounded-full bg-primary-500/20">
                        <Check className="w-4 h-4 text-primary-400" />
                      </div>
                      <span className="text-gray-300 text-sm">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                <button
                  className={`group w-full py-4 rounded-xl font-bold transition-all duration-300 flex items-center justify-center space-x-2 ${
                    plan.popular
                      ? 'bg-gradient-to-r from-primary-500 to-accent-500 text-white hover:shadow-2xl hover:shadow-primary-500/50'
                      : 'glass-light text-white hover:bg-white/10'
                  }`}
                >
                  <span>{plan.cta}</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Money Back Guarantee */}
        <div className="text-center mt-16 space-y-4">
          <div className="flex items-center justify-center space-x-8 text-sm text-gray-400">
            <div className="flex items-center space-x-2">
              <Check className="w-5 h-5 text-green-400" />
              <span>30-day money-back guarantee</span>
            </div>
            <div className="flex items-center space-x-2">
              <Check className="w-5 h-5 text-green-400" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center space-x-2">
              <Check className="w-5 h-5 text-green-400" />
              <span>Cancel anytime</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Pricing;
