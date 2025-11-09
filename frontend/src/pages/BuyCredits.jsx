import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import { CreditCard, Zap, Gift, ChevronDown, ChevronUp, ArrowRight, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const BuyCredits = () => {
  const navigate = useNavigate();
  const [isTopUpExpanded, setIsTopUpExpanded] = useState(false);
  
  const STRIPE_BILLING_URL = 'https://billing.stripe.com/p/session/live_YWNjdF8xUlA2bEVBR1ZScWFRRW1YLF9UTDBCdDVhNjRXaHNxMFVhUzJqTk5VQkVPVExZdXhQ0100SB6NIwCa';

  const subscriptionPlans = [
    {
      name: 'Starter',
      price: 49,
      period: 'per month',
      description: 'Perfect for individuals starting their SEO journey',
      features: [
        'Access to ~150 credibility reports',
        'Everything you need to get started',
        'Can track your own brand(s)',
        'Works on trending, branded, etc.',
        'Analyze rankings on 100+ prompts',
        'Receive after 14 credits top up'
      ],
      gradient: 'from-blue-500 to-cyan-500',
      border: 'border-blue-500/30'
    },
    {
      name: 'Starter Plan (7 Day Free Trial)',
      price: 0,
      originalPrice: 49,
      period: 'initially, then $49/month',
      description: 'Try our Starter plan risk-free for 7 days',
      features: [
        'Access to ~150 credibility reports',
        'Everything you need to get started',
        'Can track your own brand(s)',
        'Works on trending, branded, etc.',
        'Analyze rankings on 100+ prompts',
        'Receive after 14 credits top up'
      ],
      gradient: 'from-green-500 to-emerald-500',
      border: 'border-green-500/30',
      trial: true
    },
    {
      name: 'Pro',
      price: 89,
      period: 'per month, billed $89/mo on trial',
      description: 'Ideal for growing teams and power users',
      features: [
        'Access to ~300 credibility reports',
        'Great for industries (credits expire end of month)',
        'Can track multiple brands/clients',
        'Great share, viewership opportunities, and traffic drivers',
        'Analyze rankings on 1000+ prompts',
        'Priority support & access to alpha testing for 14 credits top up anytime for $0.40/credit',
        'Build up reports for clients, fits your workflow on 150 credits'
      ],
      gradient: 'from-purple-500 to-pink-500',
      border: 'border-purple-500/30',
      popular: true
    },
    {
      name: 'Agency',
      price: 149,
      period: 'per month, billed ~$0.75 credits',
      description: 'Built for agencies managing multiple clients',
      features: [
        'Access to ~350 credibility reports',
        'Error-proof analytics on 1000+ prompts',
        'Bulk AI powers cards and rankings at scale',
        'Works on trending & other, brandaware with clients',
        'Analyze 15 brands (subject to review with ongoing) and reports',
        'Priority support & access to alpha features',
        'Need more than 500 credits? Top up anytime for $0.40/credit',
        'Build up reports for clients and integrations with your SEO stack'
      ],
      gradient: 'from-pink-500 to-rose-500',
      border: 'border-pink-500/30'
    }
  ];

  const topUpOptions = [
    {
      credits: 50,
      price: 20,
      pricePerCredit: 0.4,
      description: 'Add 50 extra credits to run more credibility checks. Perfect for small boosts when you run out of your monthly credits.'
    },
    {
      credits: 100,
      price: 40,
      pricePerCredit: 0.4,
      description: 'Add 100 credits to your account. Ideal for extending reports or handling busier research weeks.'
    },
    {
      credits: 200,
      price: 80,
      pricePerCredit: 0.4,
      description: 'Add 200 credits instantly. Great for agencies, power users, or anyone looking for prompt volume without changing plans.'
    }
  ];

  const handlePlanPurchase = (plan) => {
    // Redirect to Stripe billing portal
    window.open(STRIPE_BILLING_URL, '_blank');
  };

  const handleTopUpPurchase = (option) => {
    // Redirect to Stripe billing portal
    window.open(STRIPE_BILLING_URL, '_blank');
  };

  return (
    <div className="flex min-h-screen gradient-bg">
      <Sidebar />
      
      <div className="flex-1 lg:ml-64 p-4 sm:p-6 md:p-8 mt-16 lg:mt-0">
        <div className="max-w-7xl mx-auto">
          {/* Page Header */}
          <div className="text-center mb-8 sm:mb-12">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-4 px-2">
              Choose Your Plan And <span className="gradient-text">Start Ranking</span>
            </h1>
            <p className="text-gray-300 text-sm sm:text-base lg:text-lg max-w-3xl mx-auto px-4">
              All plans are made to provide high-quality ChatGPT, Claude, Gemini, and Perplexity 
              citation analysis. Pick a plan that fits your needs or top-up 
              credits when you need more visibility checks.
            </p>
          </div>

          {/* Subscription Plans Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6 mb-8 sm:mb-12">
            {subscriptionPlans.map((plan, index) => (
              <div
                key={index}
                className={`glass-effect rounded-xl sm:rounded-2xl border ${plan.border} p-4 sm:p-6 flex flex-col relative ${
                  plan.popular ? 'ring-2 ring-purple-500/50' : ''
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 sm:-top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold px-4 py-1 rounded-full">
                      POPULAR
                    </span>
                  </div>
                )}

                {plan.trial && (
                  <div className="absolute -top-3 sm:-top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs font-bold px-4 py-1 rounded-full">
                      FREE TRIAL
                    </span>
                  </div>
                )}

                <div className="mb-4 sm:mb-6">
                  <h3 className="text-lg sm:text-xl font-bold text-white mb-2">{plan.name}</h3>
                  <p className="text-gray-400 text-xs sm:text-sm mb-4 min-h-[40px] sm:min-h-[40px]">{plan.description}</p>
                  
                  <div className="flex items-baseline mb-2">
                    <span className="text-3xl sm:text-4xl font-black text-white">${plan.price}</span>
                    {plan.originalPrice && (
                      <span className="text-gray-500 line-through ml-2">${plan.originalPrice}</span>
                    )}
                  </div>
                  <p className="text-gray-400 text-xs sm:text-sm">{plan.period}</p>
                </div>

                <button
                  onClick={() => handlePlanPurchase(plan)}
                  className={`w-full bg-gradient-to-r ${plan.gradient} hover:opacity-90 text-white font-bold py-2.5 sm:py-3 px-4 sm:px-6 rounded-xl transition-all mb-4 sm:mb-6 text-sm sm:text-base`}
                >
                  Sign up
                </button>

                <div className="space-y-2 sm:space-y-3 flex-1">
                  {plan.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start space-x-2">
                      <Check className="w-3 h-3 sm:w-4 sm:h-4 text-primary-400 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-300 text-xs sm:text-sm">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Need Flexibility Section */}
          <div className="glass-effect rounded-xl sm:rounded-2xl border border-purple-500/30 p-4 sm:p-6 md:p-8 mb-6">
            <div className="flex flex-col lg:flex-row items-start justify-between gap-4">
              <div className="flex items-start space-x-3 sm:space-x-4 flex-1">
                <div className="p-2 sm:p-3 rounded-xl bg-purple-500/20">
                  <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Need flexibility instead?</h2>
                  <p className="text-gray-300 text-sm sm:text-base">
                    Top up credits any time for <span className="text-primary-400 font-semibold">$0.40 per credit</span> — no subscription required.
                  </p>
                  <div className="mt-3 sm:mt-4 space-y-2">
                    <div className="flex items-center space-x-2">
                      <Check className="w-4 h-4 text-purple-400" />
                      <span className="text-gray-300 text-sm">Perfect for one-time analyses or when you're running low on credits</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Check className="w-4 h-4 text-purple-400" />
                      <span className="text-gray-300 text-sm">Choose from 3 top-up packs based on your needs</span>
                    </div>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsTopUpExpanded(!isTopUpExpanded)}
                className="glass-light hover:bg-white/10 p-3 sm:p-4 rounded-xl transition-all flex items-center space-x-2 w-full lg:w-auto justify-center lg:justify-start"
              >
                <span className="text-white font-medium">View Top-up Options</span>
                {isTopUpExpanded ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </button>
            </div>
          </div>

          {/* Top-up Credits Expanded Section */}
          {isTopUpExpanded && (
            <div className="glass-effect rounded-xl sm:rounded-2xl border border-white/10 p-4 sm:p-6 md:p-8 mb-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <Zap className="w-6 h-6 text-primary-500" />
                  <h2 className="text-2xl font-bold text-white">Top-up Credits</h2>
                </div>
                <button
                  onClick={() => setIsTopUpExpanded(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  Collapse
                </button>
              </div>

              <div className="space-y-3 sm:space-y-4">
                {topUpOptions.map((option, index) => (
                  <div
                    key={index}
                    className="glass-light rounded-xl p-4 sm:p-6 flex flex-col lg:flex-row items-start lg:items-center justify-between hover:bg-white/10 transition-all gap-4"
                  >
                    <div className="flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-3 mb-2">
                        <h3 className="text-lg sm:text-xl font-bold text-white">{option.credits} Credits Top-Up</h3>
                        <span className="text-primary-400 text-sm font-semibold">
                          ${option.pricePerCredit} per credit
                        </span>
                      </div>
                      <p className="text-gray-300 text-xs sm:text-sm">{option.description}</p>
                    </div>
                    <div className="flex items-center space-x-4 sm:space-x-6 w-full lg:w-auto lg:ml-6">
                      <div className="text-left lg:text-right flex-1 lg:flex-initial">
                        <div className="text-2xl sm:text-3xl font-black text-white">${option.price}</div>
                      </div>
                      <button
                        onClick={() => handleTopUpPurchase(option)}
                        className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-bold py-2.5 sm:py-3 px-4 sm:px-6 rounded-xl transition-all flex items-center justify-center space-x-2 flex-1 lg:flex-initial text-sm sm:text-base"
                      >
                        <span>Purchase</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Get 50 Credits Free Section */}
          <div className="glass-effect rounded-xl sm:rounded-2xl border border-green-500/30 p-4 sm:p-6 md:p-8">
            <div className="flex items-start space-x-3 sm:space-x-4">
              <div className="p-2 sm:p-3 rounded-xl bg-green-500/20">
                <Gift className="w-5 h-5 sm:w-6 sm:h-6 text-green-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Get 50 Credits Free</h2>
                <p className="text-gray-300 text-sm sm:text-base mb-4 sm:mb-6">
                  Take our quick 2-minute survey to help us improve RankPrompt and get{' '}
                  <span className="text-green-400 font-semibold">50 credits instantly!</span>
                </p>
                <button
                  onClick={() => navigate('/earn-credits')}
                  className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold py-2.5 sm:py-3 px-4 sm:px-6 rounded-xl transition-all inline-flex items-center justify-center space-x-2 w-full sm:w-auto text-sm sm:text-base"
                >
                  <Gift className="w-4 h-4" />
                  <span>Earn Free Credits</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BuyCredits;
