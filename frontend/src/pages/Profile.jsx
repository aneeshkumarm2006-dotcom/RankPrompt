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

const Profile = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [creditActivity, setCreditActivity] = useState([]);
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
      }
    } catch (error) {
      console.error('Error fetching credit activity:', error);
    } finally {
      setLoading(false);
    }
  };

  // Mock data - replace with actual data from your backend
  const creditData = {
    availableCredits: user?.credits || 0,
    billingCycleStarted: 'October 28, 2025',
    lastCreditReset: 'October 28, 2025',
    monthlyCreditsBuilt: '0 of each month',
    monthlyPlanCredits: { used: 0, total: 0 },
    topUpCredits: { used: 0, total: 0 }
  };

  const accountData = {
    currentPlan: user?.currentPlan || 'Free',
    subscriptionStatus: user?.subscriptionStatus || 'Inactive'
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
      // TODO: Uncomment when Stripe is fully configured
      // import { createBillingPortalSession } from '../services/stripeService';
      // await createBillingPortalSession();
      
      // Temporary: Opens a sample Stripe billing portal URL
      const stripeSessionUrl = 'https://billing.stripe.com/p/session/live_YWNjdF8xUlA2bEVBR1ZScWFRRW1YLF9UTDBCdDVhNjRXaHNxMFVhUzJqTk5VQkVPVExZdXhQ0100SB6NIwCa';
      window.open(stripeSessionUrl, '_blank');
    } catch (error) {
      console.error('Error opening billing portal:', error);
      toast.error('Failed to open billing portal. Please try again.');
    }
  };

  const handleSyncSubscription = async () => {
    // Implement subscription sync logic
    console.log('Syncing subscription status...');
  };

  const handleStartTrial = () => {
    // Implement trial start logic
    console.log('Starting free trial...');
  };

  const handleUpgradeToPro = () => {
    // Navigate to pricing or checkout
    console.log('Upgrading to Pro...');
  };

  return (
    <div className="flex min-h-screen gradient-bg">
      <Sidebar />
      
      <div className="flex-1 lg:ml-64 p-3 sm:p-6 md:p-8 mt-16 lg:mt-0">
        <div className="max-w-4xl mx-auto">
          {/* Page Header - Mobile Optimized */}
          <div className="mb-4 sm:mb-6">
            <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black text-white">Account</h1>
          </div>

          {/* User Profile Card - Mobile First */}
          <div className="glass-effect rounded-lg sm:rounded-xl border border-white/10 mb-4 sm:mb-6 overflow-hidden bg-gradient-to-r from-purple-500/10 to-pink-500/10">
            <div className="p-3 sm:p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-r from-primary-500 to-accent-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-base sm:text-lg">
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-white font-semibold text-sm sm:text-base truncate">{user?.email}</p>
                  <p className="text-gray-400 text-xs">Free Plan</p>
                </div>
              </div>
              <button
                onClick={handleManageBilling}
                className="flex items-center justify-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-medium px-4 py-2.5 rounded-lg transition-all text-sm w-full"
              >
                <CreditCard className="w-4 h-4" />
                <span>Manage Billing</span>
              </button>
            </div>
          </div>

          {/* Tabs - Mobile Scrollable */}
          <div className="glass-effect rounded-t-lg sm:rounded-t-xl border border-white/10 border-b-0 mb-0">
            <div className="flex overflow-x-auto scrollbar-hide gap-1 p-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all whitespace-nowrap flex-shrink-0 ${
                    activeTab === tab.id
                      ? 'bg-white/10 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
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
          <div className="glass-effect rounded-b-lg sm:rounded-b-xl border border-white/10 p-3 sm:p-5">
            {activeTab === 'overview' && (
              <div className="space-y-4 sm:space-y-6">
                {/* Credits Overview - Compact Mobile */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-primary-500" />
                    <h3 className="text-base sm:text-lg font-bold text-white">Credits</h3>
                  </div>
                  <div className="glass-light rounded-lg sm:rounded-xl p-3 sm:p-4">
                    <div className="text-center mb-3 sm:mb-4">
                      <p className="text-gray-400 text-xs sm:text-sm mb-1">Available Credits</p>
                      <p className="text-3xl sm:text-4xl font-bold text-white">{creditData.availableCredits}</p>
                    </div>
                    <div className="h-px bg-white/10 mb-3 sm:mb-4"></div>
                    <div className="space-y-2 sm:space-y-0 sm:grid sm:grid-cols-3 sm:gap-3 text-xs">
                      <div className="bg-white/5 rounded-lg p-2 sm:p-2.5">
                        <p className="text-gray-500 mb-0.5">Cycle Started</p>
                        <p className="text-white font-medium">{creditData.billingCycleStarted}</p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-2 sm:p-2.5">
                        <p className="text-gray-500 mb-0.5">Last Reset</p>
                        <p className="text-white font-medium">{creditData.lastCreditReset}</p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-2 sm:p-2.5">
                        <p className="text-gray-500 mb-0.5">Monthly Built</p>
                        <p className="text-white font-medium">{creditData.monthlyCreditsBuilt}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Unlock Free Trial - Mobile Optimized */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Gift className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
                    <h3 className="text-base sm:text-lg font-bold text-white">Free Trial</h3>
                  </div>
                  <div className="glass-light rounded-lg sm:rounded-xl p-3 sm:p-4 bg-gradient-to-br from-amber-500/5 to-orange-500/5">
                    <p className="text-gray-300 text-xs sm:text-sm mb-3 leading-relaxed">
                      <span className="text-white font-semibold">7-Day Trial</span> + <span className="text-amber-400 font-semibold">10 Credits</span> • No card required
                    </p>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div className="bg-white/5 rounded-lg p-2 text-center">
                        <p className="text-green-400 text-lg mb-0.5">✓</p>
                        <p className="text-gray-300 text-xs">7 Days</p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-2 text-center">
                        <p className="text-green-400 text-lg mb-0.5">✓</p>
                        <p className="text-gray-300 text-xs">10 Credits</p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-2 text-center">
                        <p className="text-green-400 text-lg mb-0.5">✓</p>
                        <p className="text-gray-300 text-xs">Full Access</p>
                      </div>
                    </div>
                    <button
                      onClick={handleStartTrial}
                      className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold py-2.5 sm:py-3 rounded-lg transition-all text-sm"
                    >
                      Start Free Trial
                    </button>
                  </div>
                </div>

                {/* Detailed Credit Breakdown - Simplified Mobile */}
                <div className="hidden sm:block">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-purple-500" />
                    <h3 className="text-base sm:text-lg font-bold text-white">Credit Breakdown</h3>
                  </div>
                  <div className="space-y-2 sm:space-y-3">
                    <div className="glass-light rounded-lg sm:rounded-xl p-3 sm:p-4">
                      <div className="flex items-center justify-between mb-1 sm:mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                          <span className="text-white font-medium text-xs sm:text-sm">Monthly Plan</span>
                        </div>
                        <span className="text-white font-bold text-sm">
                          {creditData.monthlyPlanCredits.used}/{creditData.monthlyPlanCredits.total}
                        </span>
                      </div>
                      <p className="text-gray-500 text-xs pl-4">Renews monthly</p>
                    </div>

                    <div className="glass-light rounded-lg sm:rounded-xl p-3 sm:p-4">
                      <div className="flex items-center justify-between mb-1 sm:mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-pink-500"></div>
                          <span className="text-white font-medium text-xs sm:text-sm">Top-up</span>
                        </div>
                        <span className="text-white font-bold text-sm">
                          {creditData.topUpCredits.used}/{creditData.topUpCredits.total}
                        </span>
                      </div>
                      <p className="text-gray-500 text-xs pl-4">Never expire</p>
                    </div>
                  </div>
                </div>

                {/* Account Section - Mobile Optimized */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Crown className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
                    <h3 className="text-base sm:text-lg font-bold text-white">Subscription</h3>
                  </div>
                  <div className="glass-light rounded-lg sm:rounded-xl p-3 sm:p-4">
                    <div className="space-y-2 mb-3">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400 text-xs sm:text-sm">Plan</span>
                        <span className="text-white font-semibold text-sm">{accountData.currentPlan}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400 text-xs sm:text-sm">Status</span>
                        <span className="text-gray-400 text-sm">{accountData.subscriptionStatus}</span>
                      </div>
                    </div>
                    <button
                      onClick={handleUpgradeToPro}
                      className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-bold py-2.5 rounded-lg transition-all text-sm"
                    >
                      Upgrade to Pro
                    </button>
                  </div>
                </div>

                {/* Sync Subscription Status */}
                <div className="text-center pt-2">
                  <button
                    onClick={handleSyncSubscription}
                    className="inline-flex items-center gap-2 text-primary-400 hover:text-primary-300 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="text-xs sm:text-sm">Sync Status</span>
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'credit-log' && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-primary-500" />
                  <h3 className="text-base sm:text-lg font-bold text-white">Activity</h3>
                </div>
                {loading ? (
                  <div className="glass-light rounded-lg p-8 text-center">
                    <p className="text-gray-400 text-sm">Loading...</p>
                  </div>
                ) : creditActivity.length > 0 ? (
                  <div className="space-y-2">
                    {creditActivity.map((log) => (
                      <div key={log._id} className="glass-light rounded-lg p-3">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-medium text-xs sm:text-sm leading-tight">{log.description}</p>
                            <p className="text-gray-500 text-xs mt-0.5">
                              {new Date(log.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} • {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className={`font-bold text-base sm:text-lg ${
                              log.amount > 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {log.amount > 0 ? '+' : ''}{log.amount}
                            </p>
                            <p className="text-gray-500 text-xs">
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
                          <span className="text-xs px-2 py-0.5 rounded bg-white/5 text-gray-400">
                            {log.source}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="glass-light rounded-lg p-8 text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/5 mb-3">
                      <Info className="w-6 h-6 text-gray-500" />
                    </div>
                    <p className="text-gray-400 text-sm">No activity yet</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'topup-transactions' && (
              <div>
                <div className="mb-3">
                  <h3 className="text-base sm:text-lg font-bold text-white">Top-ups</h3>
                  <p className="text-gray-400 text-xs">Purchase history</p>
                </div>
                <div className="glass-light rounded-lg p-6 sm:p-8 text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-purple-500/10 mb-3">
                    <CreditCard className="w-6 h-6 sm:w-7 sm:h-7 text-purple-400" />
                  </div>
                  <h4 className="text-white font-semibold text-sm sm:text-base mb-1">No purchases yet</h4>
                  <p className="text-gray-400 text-xs sm:text-sm">Your purchase history will appear here</p>
                </div>
              </div>
            )}

            {activeTab === 'subscription-invoices' && (
              <div>
                <div className="glass-light rounded-lg p-5 sm:p-8 text-center bg-gradient-to-br from-purple-500/5 to-pink-500/5 border border-purple-500/20">
                  <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-purple-500/10 mb-3 sm:mb-4">
                    <Calendar className="w-6 h-6 sm:w-7 sm:h-7 text-purple-400" />
                  </div>
                  <h4 className="text-white font-bold text-sm sm:text-base mb-2">Invoices & Receipts</h4>
                  <p className="text-gray-300 text-xs sm:text-sm mb-4 sm:mb-5">
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
