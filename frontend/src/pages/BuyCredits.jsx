import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import { CreditCard, Zap, Gift, ChevronDown, ChevronUp, ArrowRight, Check, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createCheckoutSession, createTopUpSession } from '../services/stripeService';

const BuyCredits = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isTopUpExpanded, setIsTopUpExpanded] = useState(false);
  
  const subscriptionPlans = [
    {
      key: 'starter',
      name: 'Starter',
      price: 49,
      period: 'per month',
      description: 'For individuals looking to explore AI visibility and scan key prompts.',
      features: [
        { label: '150 credits/month', available: true },
        { label: 'All AI platforms (ChatGPT, Perplexity, AI Overviews)', available: true },
        { label: 'White-label exports', available: false },
        { label: 'Team collaboration', available: false },
        { label: 'Priority support', available: false }
      ],
      gradient: 'from-blue-500 to-cyan-500',
      border: 'border-blue-500/30'
    },
    {
      key: 'pro',
      name: 'Pro',
      price: 89,
      period: 'per month',
      description: 'For companies and teams ready to monitor AI rankings more actively.',
      features: [
        { label: '500 credits/month', available: true },
        { label: 'All AI platforms (ChatGPT, Perplexity, AI Overviews)', available: true },
        { label: 'White-label exports', available: true },
        { label: 'Team collaboration', available: false },
        { label: 'Priority support', available: false }
      ],
      gradient: 'from-purple-500 to-pink-500',
      border: 'border-purple-500/30',
      popular: true
    },
    {
      key: 'agency',
      name: 'Agency',
      price: 149,
      period: 'per month',
      description: 'For agencies and enterprises managing multiple clients, campaigns, or brands.',
      features: [
        { label: '1000 credits/month', available: true },
        { label: 'All AI platforms (ChatGPT, Perplexity, AI Overviews)', available: true },
        { label: 'White-label exports', available: true },
        { label: 'Team collaboration', available: true },
        { label: 'Priority support', available: true }
      ],
      gradient: 'from-pink-500 to-rose-500',
      border: 'border-pink-500/30'
    }
  ];

  const topUpOptions = [
    {
      key: 'topup50',
      credits: 50,
      price: 20,
      pricePerCredit: 0.4,
      description: 'Add 50 extra credits to run more credibility checks. Perfect for small boosts when you run out of your monthly credits.'
    },
    {
      key: 'topup100',
      credits: 100,
      price: 40,
      pricePerCredit: 0.4,
      description: 'Add 100 credits to your account. Ideal for extending reports or handling busier research weeks.'
    },
    {
      key: 'topup200',
      credits: 200,
      price: 80,
      pricePerCredit: 0.4,
      description: 'Add 200 credits instantly. Great for agencies, power users, or anyone looking for prompt volume without changing plans.'
    }
  ];

  const handlePlanPurchase = async (plan) => {
    if (!plan?.key) return;
    try {
      await createCheckoutSession(plan.key);
    } catch (error) {
      console.error('Error starting checkout:', error);
    }
  };

  const handleTopUpPurchase = async (option) => {
    if (!option?.key) return;
    try {
      await createTopUpSession(option.key);
    } catch (error) {
      console.error('Error starting top-up:', error);
    }
  };

  return (
        <div className="flex min-h-screen bg-gray-50 dark:bg-dark-950">
      <Sidebar />
      <div className="flex-1 lg:ml-64 p-4 sm:p-6 md:p-8 mt-16 lg:mt-0">
        <div className="max-w-7xl mx-auto">
          <header className="mb-10 text-center">
            <h1 className="text-4xl sm:text-5xl font-black text-gray-900 dark:text-white tracking-tight">Plans & Pricing</h1>
            <p className="mt-3 text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">Find the perfect plan to boost your AI visibility. Upgrade, downgrade, or cancel anytime.</p>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
            {subscriptionPlans.map((plan) => (
              <div
                key={plan.key}
                className={`relative bg-white dark:bg-dark-900 rounded-2xl p-8 flex flex-col transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 ${plan.popular ? 'border-2 border-purple-500 shadow-xl' : 'border border-gray-200 dark:border-dark-700'}`}
              >
                {plan.popular && (
                  <div className="absolute top-0 -translate-y-1/2 left-1/2 -translate-x-1/2">
                    <span className="bg-purple-500 text-white text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wider shadow-md">Most Popular</span>
                  </div>
                )}

                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{plan.name}</h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mb-6 h-10">{plan.description}</p>

                  <div className="mb-6 flex items-baseline">
                    <span className="text-5xl font-extrabold text-gray-900 dark:text-white">${plan.price}</span>
                    <span className="ml-1 text-lg text-gray-500 dark:text-gray-400">/month</span>
                  </div>

                  <button
                    onClick={() => handlePlanPurchase(plan)}
                    disabled={user?.currentPlan === plan.key}
                    className={`w-full font-bold py-3 px-6 rounded-lg transition-all text-base shadow-sm ${
                      user?.currentPlan === plan.key
                        ? 'bg-gray-300 dark:bg-dark-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                        : plan.popular
                        ? 'bg-purple-600 hover:bg-purple-700 text-white'
                        : 'bg-gray-800 dark:bg-dark-700 hover:bg-gray-900 dark:hover:bg-dark-600 text-white'
                    }`}>
                    {user?.currentPlan === plan.key ? 'Current Plan' : 'Get Started'}
                  </button>

                  <div className="border-t border-gray-200 dark:border-dark-700 my-8"></div>

                  <ul className="space-y-4">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center space-x-3">
                        {feature.available ? (
                          <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                        ) : (
                          <X className="w-5 h-5 text-gray-400 flex-shrink-0" />
                        )}
                        <span className={`text-sm ${feature.available ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500 line-through'}`}>
                          {feature.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white dark:bg-dark-900 rounded-2xl border border-gray-200 dark:border-dark-700 p-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex-1 text-center md:text-left">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Need more flexibility?</h3>
                <p className="text-gray-600 dark:text-gray-400">Top up your credits anytime. They never expire and roll over indefinitely.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full md:w-auto">
                {topUpOptions.map((option) => (
                  <div key={option.key} className="bg-gray-50 dark:bg-dark-800 rounded-xl p-4 text-center border border-gray-200 dark:border-dark-700 hover:border-purple-400 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-all">
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">{option.credits}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Credits</p>
                    <button
                      onClick={() => handleTopUpPurchase(option)}
                      className="w-full bg-purple-600 hover:bg-purple-700 dark:bg-action-600 dark:hover:bg-action-700 text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm">
                      Buy for ${option.price}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default BuyCredits;
