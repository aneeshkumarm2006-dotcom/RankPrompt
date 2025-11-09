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
      
      <div className="flex-1 lg:ml-64 p-4 sm:p-6 md:p-8 mt-16 lg:mt-0">
        <div className="max-w-4xl mx-auto">
          {/* Page Header */}
          <div className="mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white mb-2">Account Settings</h1>
          </div>

          {/* User Profile Card */}
          <div className="glass-effect rounded-xl sm:rounded-2xl border border-white/10 mb-6 overflow-hidden bg-gradient-to-r from-purple-500/10 to-pink-500/10">
            <div className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-3 sm:space-x-4">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-r from-primary-500 to-accent-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-lg sm:text-xl">
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-white font-semibold text-base sm:text-lg break-all">{user?.email}</p>
                  <p className="text-gray-400 text-xs sm:text-sm">Free Plan</p>
                </div>
              </div>
              <button
                onClick={handleManageBilling}
                className="flex items-center justify-center space-x-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-medium px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl transition-all text-sm sm:text-base w-full sm:w-auto"
              >
                <CreditCard className="w-4 h-4" />
                <span>Manage Billing</span>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="glass-effect rounded-t-xl sm:rounded-t-2xl border border-white/10 border-b-0">
            <div className="flex overflow-x-auto space-x-1 p-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-3 sm:px-4 py-2.5 rounded-lg transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-white/10 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  <span className="text-xs sm:text-sm font-medium">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="glass-effect rounded-b-xl sm:rounded-b-2xl border border-white/10 p-4 sm:p-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Credits Overview */}
                <div>
                  <div className="flex items-center space-x-2 mb-4">
                    <Zap className="w-5 h-5 text-primary-500" />
                    <h3 className="text-lg font-bold text-white">Credits Overview</h3>
                  </div>
                  <div className="glass-light rounded-xl p-3 sm:p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Available Credits</span>
                      <span className="text-2xl font-bold text-white">{creditData.availableCredits}</span>
                    </div>
                    <div className="h-px bg-white/10"></div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 text-xs sm:text-sm">
                      <div>
                        <p className="text-gray-500">Billing Cycle Started</p>
                        <p className="text-white font-medium">{creditData.billingCycleStarted}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Last Credit Reset</p>
                        <p className="text-white font-medium">{creditData.lastCreditReset}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Monthly Credits Built</p>
                        <p className="text-white font-medium">{creditData.monthlyCreditsBuilt}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Unlock Free Trial */}
                <div>
                  <div className="flex items-center space-x-2 mb-4">
                    <Gift className="w-5 h-5 text-amber-500" />
                    <h3 className="text-lg font-bold text-white">Unlock Your Free Trial</h3>
                  </div>
                  <div className="glass-light rounded-xl p-5">
                    <p className="text-gray-300 text-sm sm:text-base mb-4">
                      Start your <span className="text-white font-semibold">7-Day Free Trial</span> and get{' '}
                      <span className="text-primary-400 font-semibold">10 bonus credits</span> to analyze your brand's AI visibility.{' '}
                      <span className="text-white font-semibold">No Credit</span> today, cancel anytime.
                    </p>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-4">
                      <div className="flex items-center space-x-4 text-sm">
                        <div className="flex items-center space-x-2">
                          <span className="text-green-400">✓</span>
                          <span className="text-gray-300">7-Day Free Trial</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-green-400">✓</span>
                          <span className="text-gray-300">10 Bonus Credits</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-green-400">✓</span>
                          <span className="text-gray-300">Full Access</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={handleStartTrial}
                      className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold py-2.5 sm:py-3 px-4 sm:px-6 rounded-xl transition-all text-sm sm:text-base"
                    >
                      Start Free Trial
                    </button>
                  </div>
                </div>

                {/* Detailed Credit Breakdown */}
                <div>
                  <div className="flex items-center space-x-2 mb-4">
                    <TrendingUp className="w-5 h-5 text-purple-500" />
                    <h3 className="text-lg font-bold text-white">Detailed Credit Breakdown</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="glass-light rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                          <span className="text-white font-medium">Monthly Plan Credits</span>
                        </div>
                        <span className="text-white font-bold">
                          {creditData.monthlyPlanCredits.used}/{creditData.monthlyPlanCredits.total}
                        </span>
                      </div>
                      <p className="text-gray-500 text-xs">Renews monthly on plan</p>
                    </div>

                    <div className="glass-light rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 rounded-full bg-pink-500"></div>
                          <span className="text-white font-medium">Top-up Credits</span>
                        </div>
                        <span className="text-white font-bold">
                          {creditData.topUpCredits.used}/{creditData.topUpCredits.total}
                        </span>
                      </div>
                      <p className="text-gray-500 text-xs">Never expire until used</p>
                    </div>
                  </div>
                </div>

                {/* Account Section */}
                <div>
                  <div className="flex items-center space-x-2 mb-4">
                    <Crown className="w-5 h-5 text-amber-500" />
                    <h3 className="text-lg font-bold text-white">Account</h3>
                  </div>
                  <div className="glass-light rounded-xl p-5">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-gray-400">Current Plan</span>
                      <span className="text-white font-semibold">{accountData.currentPlan}</span>
                    </div>
                    <div className="flex justify-between items-center mb-5">
                      <span className="text-gray-400">Subscription Status</span>
                      <span className="text-gray-400">{accountData.subscriptionStatus}</span>
                    </div>
                    <button
                      onClick={handleUpgradeToPro}
                      className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-bold py-3 px-6 rounded-xl transition-all"
                    >
                      Upgrade to Pro
                    </button>
                  </div>
                </div>

                {/* Sync Subscription Status */}
                <div className="text-center">
                  <button
                    onClick={handleSyncSubscription}
                    className="inline-flex items-center space-x-2 text-primary-400 hover:text-primary-300 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span className="text-sm">Sync Subscription Status</span>
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'credit-log' && (
              <div>
                <div className="flex items-center space-x-2 mb-4">
                  <CreditCard className="w-5 h-5 text-primary-500" />
                  <h3 className="text-lg font-bold text-white">Credit Activity Log</h3>
                </div>
                {loading ? (
                  <div className="glass-light rounded-xl p-12 text-center">
                    <p className="text-gray-400">Loading...</p>
                  </div>
                ) : creditActivity.length > 0 ? (
                  <div className="space-y-3">
                    {creditActivity.map((log) => (
                      <div key={log._id} className="glass-light rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="text-white font-medium">{log.description}</p>
                            <p className="text-gray-500 text-xs">
                              {new Date(log.createdAt).toLocaleDateString()} at{' '}
                              {new Date(log.createdAt).toLocaleTimeString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className={`font-bold text-lg ${
                              log.amount > 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {log.amount > 0 ? '+' : ''}{log.amount}
                            </p>
                            <p className="text-gray-500 text-xs">
                              Balance: {log.balanceAfter}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`text-xs px-2 py-1 rounded ${
                            log.type === 'earned' ? 'bg-green-500/20 text-green-400' :
                            log.type === 'spent' ? 'bg-red-500/20 text-red-400' :
                            'bg-blue-500/20 text-blue-400'
                          }`}>
                            {log.type}
                          </span>
                          <span className="text-xs px-2 py-1 rounded bg-white/5 text-gray-400">
                            {log.source}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="glass-light rounded-xl p-12 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/5 mb-4">
                      <Info className="w-8 h-8 text-gray-500" />
                    </div>
                    <p className="text-gray-400">No credit activity yet</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'topup-transactions' && (
              <div>
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-white">Top-up Transactions</h3>
                  <p className="text-gray-400 text-sm">Credits top-up transaction history</p>
                </div>
                <div className="glass-light rounded-xl p-12 text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-500/10 mb-4">
                    <CreditCard className="w-8 h-8 text-purple-400" />
                  </div>
                  <h4 className="text-white font-semibold text-lg mb-2">No top-up transactions yet</h4>
                  <p className="text-gray-400 text-sm mb-1">This section shows credit top-up purchases only.</p>
                  <p className="text-gray-500 text-xs">Your top-up transaction history will appear here on, make a purchase.</p>
                </div>
              </div>
            )}

            {activeTab === 'subscription-invoices' && (
              <div>
                <div className="glass-light rounded-xl p-12 text-center bg-gradient-to-br from-purple-500/5 to-pink-500/5 border border-purple-500/20">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-purple-500/10 mb-6">
                    <Calendar className="w-8 h-8 text-purple-400" />
                  </div>
                  <h4 className="text-white font-bold text-xl mb-2">Subscription Invoices & Receipts</h4>
                  <p className="text-gray-300 mb-6">
                    View all your subscription invoices, download receipts, and manage your billing.
                  </p>
                  <button
                    onClick={handleManageBilling}
                    className="inline-flex items-center space-x-2 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-bold py-3 px-8 rounded-xl transition-all"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Open Billing Portal</span>
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
