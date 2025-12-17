import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import { 
  CreditCard, 
  Zap, 
  Calendar, 
  RefreshCw, 
  TrendingUp,
  Crown,
  ExternalLink,
  Gift,
  DollarSign,
  Info
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createBillingPortalSession } from '../services/stripeService';

const Profile = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [creditActivity, setCreditActivity] = useState([]);
  const [topupActivity, setTopupActivity] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'credit-log') {
      fetchCreditActivity();
    }
  }, [activeTab]);

  const fetchCreditActivity = async () => {
    try {
      setLoading(true);
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

      const response = await fetch(`${API_URL}/credits/activity`, {
        method: 'GET',
        credentials: 'include',
      });

      const data = await response.json();
      if (data.success) {
        setCreditActivity(data.data);
        setTopupActivity(data.data.filter((log) => ['purchase', 'subscription'].includes(log.source)));
      }
    } catch (error) {
      console.error('Error fetching credit activity:', error);
    } finally {
      setLoading(false);
    }
  };

  // Mock data - replace with actual data from your backend
  const formatPlan = (plan) => {
    if (!plan) return 'Free';
    const normalized = (plan || '').toString();
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  };

  const formatStatus = (status) => {
    if (!status) return 'Inactive';
    const normalized = status.toString().replace('_', ' ');
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  };

  const creditData = {
    availableCredits: user?.credits || 0,
    billingCycleStarted: user?.subscriptionStartDate ? new Date(user.subscriptionStartDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A',
    lastCreditReset: user?.lastCreditReset ? new Date(user.lastCreditReset).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A',
    monthlyCreditsBuilt: '0 of each month',
    monthlyPlanCredits: { used: 0, total: 0 },
    topUpCredits: { used: 0, total: 0 }
  };

  const accountData = {
    currentPlan: formatPlan(user?.currentPlan || 'Free'),
    subscriptionStatus: formatStatus(user?.subscriptionStatus || 'Inactive'),
    allowedModels: user?.allowedModels || ['chatgpt'],
  };

  const trialData = {
    daysRemaining: 7,
    freeCredits: 10,
    fullAccess: true
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Zap },
    { id: 'credit-log', label: 'Credit Log', icon: CreditCard },
    { id: 'topup-transactions', label: 'Top-up Transactions', icon: DollarSign },
    { id: 'subscription-invoices', label: 'Subscription Invoices', icon: Calendar }
  ];

  const handleManageBilling = async () => {
    try {
      await createBillingPortalSession();
    } catch (error) {
      console.error('Error opening billing portal:', error);
      toast.error('Failed to open billing portal. Please try again.');
    }
  };

  const getUpgradeButtonText = () => {
    const currentPlan = user?.currentPlan || 'free';
    switch (currentPlan.toLowerCase()) {
      case 'free':
        return 'Upgrade to Starter';
      case 'starter':
        return 'Upgrade to Pro';
      case 'pro':
        return 'Upgrade to Agency';
      case 'agency':
        return 'Current Plan';
      default:
        return 'Upgrade Plans';
    }
  };

  const handleUpgradeToPro = () => {
    const currentPlan = user?.currentPlan || 'free';
    if (currentPlan.toLowerCase() === 'agency') {
      return; // Already on highest plan
    }
    navigate('/buy-credits#pricing');
  };

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-dark-950">
      <Sidebar />
      
      <div className="flex-1 lg:ml-64 p-3 sm:p-6 md:p-8 mt-16 lg:mt-0">
        <div className="max-w-4xl mx-auto">
          {/* Page Header - Mobile Optimized */}
          <div className="mb-4 sm:mb-6">
            <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black text-gray-800 dark:text-white">Account</h1>
          </div>

          {/* User Profile Card - Mobile First */}
          <div className="bg-white dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-lg sm:rounded-xl mb-4 sm:mb-6 overflow-hidden">
            <div className="p-3 sm:p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-r from-primary-500 to-accent-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-base sm:text-lg">
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-gray-800 dark:text-white font-semibold text-sm sm:text-base truncate">{user?.email}</p>
                  <p className="text-gray-600 dark:text-gray-400 text-xs">
                    {accountData.currentPlan} • {accountData.subscriptionStatus}
                  </p>
                </div>
              </div>
              <button
                onClick={handleManageBilling}
                className="flex items-center justify-center gap-2 bg-action-600 dark:bg-action-700 text-white font-medium px-4 py-2.5 rounded-lg transition-all text-sm w-full hover:bg-action-700 dark:hover:bg-action-800"
              >
                <CreditCard className="w-4 h-4" />
                <span>Manage Billing</span>
              </button>
            </div>
          </div>

          {/* Tabs - Mobile Scrollable */}
          <div className="bg-white dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-t-lg sm:rounded-t-xl border-b-0 mb-0">
            <div className="flex overflow-x-auto scrollbar-hide gap-1 p-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all whitespace-nowrap flex-shrink-0 ${
                    activeTab === tab.id
                      ? 'bg-gray-200 dark:bg-dark-700 text-gray-800 dark:text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-dark-800'
                  }`}
                >
                  <tab.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="text-xs sm:text-sm font-medium hidden sm:inline">{tab.label}</span>
                  <span className="text-xs font-medium sm:hidden">
                    {tab.id === 'overview' ? 'Home' : 
                     tab.id === 'credit-log' ? 'Credits' :
                     tab.id === 'topup-transactions' ? 'Top-ups' : 'Invoices'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content - Mobile Optimized */}
          <div className="bg-white dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-b-lg sm:rounded-b-xl p-3 sm:p-5">
            {activeTab === 'overview' && (
              <div className="space-y-4 sm:space-y-6">
                {/* Credits Overview - Compact Mobile */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-primary-500" />
                    <h3 className="text-base sm:text-lg font-bold text-gray-800 dark:text-white">Credits</h3>
                  </div>
                  <div className="bg-gray-100 dark:bg-dark-800 rounded-lg sm:rounded-xl p-3 sm:p-4">
                    <div className="text-center mb-3 sm:mb-4">
                      <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm mb-1">Available Credits</p>
                      <p className="text-3xl sm:text-4xl font-bold text-gray-800 dark:text-white">{creditData.availableCredits}</p>
                    </div>
                  </div>
                </div>

                {/* Account Section - Mobile Optimized */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Crown className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
                    <h3 className="text-base sm:text-lg font-bold text-gray-800 dark:text-white">Subscription</h3>
                  </div>
                  <div className="bg-gray-100 dark:bg-dark-800 rounded-lg sm:rounded-xl p-3 sm:p-4">
                    <div className="space-y-2 mb-3">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">Plan</span>
                        <span className="text-gray-800 dark:text-white font-semibold text-sm">{accountData.currentPlan}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">Status</span>
                        <span className="text-gray-600 dark:text-gray-400 text-sm">{accountData.subscriptionStatus}</span>
                      </div>
                      <div className="space-y-1">
                        <span className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">Allowed AI Models</span>
                        <div className="flex flex-wrap gap-1">
                          {accountData.allowedModels.map((model) => (
                            <span key={model} className="px-2 py-1 bg-white dark:bg-dark-700 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-dark-600 rounded text-xs capitalize">
                              {model === 'google_ai_overview' ? 'AI Overviews' : model}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={handleUpgradeToPro}
                      disabled={user?.currentPlan?.toLowerCase() === 'agency'}
                      className={`w-full font-bold py-2.5 rounded-lg transition-all text-sm ${
                        user?.currentPlan?.toLowerCase() === 'agency'
                          ? 'bg-gray-300 dark:bg-dark-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                          : 'bg-[#4F46E5] text-white hover:bg-[#4338CA] dark:bg-action-600 dark:hover:bg-action-700'
                      }`}
                    >
                      {getUpgradeButtonText()}
                    </button>
                  </div>
                </div>

                {/* Sync Subscription Status */}
                <div className="text-center pt-2">
                  {/* <button
                    onClick={handleSyncSubscription}
                    className="inline-flex items-center gap-2 text-action-500 hover:text-action-600 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span className="text-xs sm:text-sm">Sync Status</span>
                  </button> */}
                </div>
              </div>
            )}

            {activeTab === 'credit-log' && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-primary-500" />
                  <h3 className="text-base sm:text-lg font-bold text-gray-800 dark:text-white">Activity</h3>
                </div>
                {loading ? (
                  <div className="bg-gray-100 dark:bg-dark-800 rounded-lg p-8 text-center">
                    <p className="text-gray-600 dark:text-gray-400 text-sm">Loading...</p>
                  </div>
                ) : creditActivity.length > 0 ? (
                  <div className="space-y-2">
                    {creditActivity.map((log) => (
                      <div key={log._id} className="bg-gray-100 dark:bg-dark-800 rounded-lg p-3">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-gray-800 dark:text-gray-200 font-medium text-xs sm:text-sm leading-tight">{log.description}</p>
                            <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">
                              {new Date(log.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} • {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className={`font-bold text-base sm:text-lg ${
                              log.amount > 0 ? 'text-green-500' : 'text-red-500'
                            }`}>
                              {log.amount > 0 ? '+' : ''}{log.amount}
                            </p>
                            <p className="text-gray-600 dark:text-gray-400 text-xs">
                              {log.balanceAfter}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            log.type === 'earned' ? 'bg-green-500/20 text-green-400' :
                            log.type === 'spent' ? 'bg-red-500/20 text-red-400' :
                            'bg-blue-500/20 text-blue-400'
                          }`}>
                            {log.type}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded bg-gray-200 dark:bg-dark-700 text-gray-600 dark:text-gray-300">
                            {log.source}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-gray-100 dark:bg-dark-800 rounded-lg p-8 text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-200 dark:bg-dark-700 mb-3">
                      <Info className="w-6 h-6 text-gray-500 dark:text-gray-400" />
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">No activity yet</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'topup-transactions' && (
              <div>
                <div className="mb-3">
                  <h3 className="text-base sm:text-lg font-bold text-gray-800 dark:text-white">Top-ups</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-xs">Purchase history</p>
                </div>
                {topupActivity.length > 0 ? (
                  <div className="bg-gray-100 dark:bg-dark-800 rounded-lg p-4 space-y-3">
                    {topupActivity.map((log) => (
                      <div key={log._id} className="flex items-center justify-between bg-white dark:bg-dark-700 p-3 rounded-md">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">{log.description}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{new Date(log.createdAt).toLocaleString()}</p>
                        </div>
                        <p className="text-sm font-semibold text-green-600">+{log.amount} credits</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-gray-100 dark:bg-dark-800 rounded-lg p-6 sm:p-8 text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-purple-500/10 mb-3">
                      <CreditCard className="w-6 h-6 sm:w-7 sm:h-7 text-purple-400" />
                    </div>
                    <h4 className="text-gray-800 dark:text-white font-semibold text-sm sm:text-base mb-1">No purchases yet</h4>
                    <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">Your purchase history will appear here</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'subscription-invoices' && (
              <div>
                <div className="bg-gray-100 dark:bg-dark-800 rounded-lg p-5 sm:p-8 text-center border border-gray-200 dark:border-dark-700">
                  <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-purple-500/10 mb-3 sm:mb-4">
                    <Calendar className="w-6 h-6 sm:w-7 sm:h-7 text-purple-400" />
                  </div>
                  <h4 className="text-gray-800 dark:text-white font-bold text-sm sm:text-base mb-2">Invoices & Receipts</h4>
                  <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm mb-4 sm:mb-5">
                    Manage invoices and billing
                  </p>
                  <button
                    onClick={handleManageBilling}
                    className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-bold py-2.5 px-5 sm:px-6 rounded-lg transition-all text-sm w-full sm:w-auto"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Open Portal</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;