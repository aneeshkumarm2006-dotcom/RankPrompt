import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Sparkles, Crown, Zap, ArrowRight, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { createCheckoutSession } from '../services/stripeService';
import { useAuth } from '../context/AuthContext';

const plans = [
  {
    key: 'starter',
    name: 'Starter',
    price: '49',
    subtitle: 'For individuals looking to explore AI visibility and scan key prompts.',
    description: '150 credits included (~$0.32 per credit)',
    features: [
      { label: '150 credits/month', available: true },
      { label: 'All AI platforms (ChatGPT, Perplexity, AI Overviews)', available: true },
      { label: 'White-label exports', available: false },
      { label: 'Team collaboration', available: false },
      { label: 'Priority support', available: false },
    ],
    cta: 'Get started',
    popular: false,
  },
  {
    key: 'pro',
    name: 'Pro',
    price: '89',
    subtitle: 'For companies and teams ready to monitor AI rankings more actively.',
    description: '500 credits included (~$0.18 per credit • Save 40% vs Starter)',
    features: [
      { label: '500 credits/month', available: true },
      { label: 'All AI platforms (ChatGPT, Perplexity, AI Overviews)', available: true },
      { label: 'White-label exports', available: true },
      { label: 'Team collaboration', available: false },
      { label: 'Priority support', available: false },
    ],
    cta: 'Get started',
    popular: true,
  },
  {
    key: 'agency',
    name: 'Agency',
    price: '149',
    subtitle: 'For agencies and enterprises managing multiple clients, campaigns, or brands.',
    description: '1000 credits included (~$0.15 per credit • Save 55% vs Starter)',
    features: [
      { label: '1000 credits/month', available: true },
      { label: 'All AI platforms (ChatGPT, Perplexity, AI Overviews)', available: true },
      { label: 'White-label exports', available: true },
      { label: 'Team collaboration', available: true },
      { label: 'Priority support', available: true },
    ],
    cta: 'Get started',
    popular: false,
  },
];

const Pricing = () => {
  const [loadingPlan, setLoadingPlan] = useState(null);
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const handleSelectPlan = async (plan) => {
    if (!plan?.key) return;
    
    // Check if user is authenticated
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    
    try {
      setLoadingPlan(plan.key);
      const resp = await createCheckoutSession(plan.key);
      if (!resp?.success) {
        toast.error(resp?.message || 'Failed to start checkout');
        setLoadingPlan(null);
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to start checkout');
      setLoadingPlan(null);
    }
  };

  return (
    <section id="pricing" className="py-24 px-4 sm:px-6 lg:px-8 bg-white dark:bg-dark-950 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0">
        <div className="absolute top-20 right-0 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 left-0 w-96 h-96 bg-accent-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-12 sm:mb-16 lg:mb-20 space-y-4 sm:space-y-6 animate-slide-up">
          <div className="inline-flex items-center space-x-2 bg-purple-100 dark:bg-purple-500/10 px-4 py-2 rounded-full text-sm font-medium mb-4">
            <Sparkles className="w-4 h-4 text-purple-600" />
            <span className="text-gray-800 dark:text-purple-300">Flexible Pricing</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-gray-800 dark:text-white leading-tight">
            Choose Your
            <span className="gradient-text"> Plan</span>
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto px-4">
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
                    ? 'bg-white dark:bg-dark-900 border-2 border-purple-600 dark:border-primary-500 shadow-2xl shadow-purple-200 dark:shadow-primary-500/20'
                    : 'bg-gray-50 dark:bg-dark-800 border border-gray-200 dark:border-dark-700 hover:border-purple-300 dark:hover:border-purple-400'
                }`}
              >
                {/* Icon */}
                <div className="mb-6">
                  {index === 0 && <Zap className="w-10 h-10 text-primary-400" />}
                  {index === 1 && <Crown className="w-10 h-10 text-primary-400" />}
                  {index === 2 && <Sparkles className="w-10 h-10 text-primary-400" />}
                </div>

                {/* Plan Name */}
                <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
                  {plan.name}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">{plan.subtitle}</p>
                <p className="text-gray-600 dark:text-gray-400 text-xs mb-8">{plan.description}</p>

                {/* Price */}
                <div className="mb-8">
                  <div className="flex items-baseline">
                    {plan.price !== 'Custom' && (
                      <span className="text-3xl font-bold text-gray-600 dark:text-gray-400">$</span>
                    )}
                    <span className="text-6xl font-black gradient-text">
                      {plan.price}
                    </span>
                    {plan.price !== 'Custom' && (
                      <span className="ml-2 text-gray-600 dark:text-gray-400">/month</span>
                    )}
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start space-x-3">
                      <div className={`mt-1 p-1 rounded-full ${feature.available ? 'bg-green-100 dark:bg-green-500/10' : 'bg-gray-200 dark:bg-dark-700'}`}>
                        {feature.available ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <X className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                        )}
                      </div>
                      <span className={`text-sm ${feature.available ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500 line-through'}`}>
                        {feature.label}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                <button
                  onClick={() => handleSelectPlan(plan)}
                  disabled={loadingPlan === plan.key}
                  className={`group w-full py-4 rounded-xl font-bold transition-all duration-300 flex items-center justify-center space-x-2 ${
                    plan.popular
                      ? 'bg-primary-500 text-white hover:bg-primary-600'
                      : 'bg-white dark:bg-dark-800 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-700 border border-gray-300 dark:border-dark-600'
                  } ${loadingPlan === plan.key ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <span>{loadingPlan === plan.key ? 'Redirecting…' : plan.cta}</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Money Back Guarantee */}
        <div className="text-center mt-16 space-y-4">
          <div className="flex items-center justify-center space-x-8 text-sm text-gray-600 dark:text-gray-400">
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
