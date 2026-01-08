import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import { Gift, Users, Copy, Check, Sparkles, X } from 'lucide-react';
import SurveyModal from '../components/SurveyModal';

const EarnCredits = () => {
  const { user, refreshUser } = useAuth();
  const [showSurveyModal, setShowSurveyModal] = useState(false);
  const [referralData, setReferralData] = useState(null);
  const [surveyStatus, setSurveyStatus] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    fetchReferralData();
    fetchSurveyStatus();
  }, []);

  const fetchReferralData = async () => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

      const response = await fetch(`${API_URL}/credits/referrals`, {
        method: 'GET',
        credentials: 'include',
      });

      const data = await response.json();
      if (data.success) {
        setReferralData(data.data);
      }
    } catch (error) {
      console.error('Error fetching referral data:', error);
    }
  };

  const fetchSurveyStatus = async () => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

      const response = await fetch(`${API_URL}/credits/survey/status`, {
        method: 'GET',
        credentials: 'include',
      });

      const data = await response.json();
      if (data.success) {
        setSurveyStatus(data.data);
      }
    } catch (error) {
      console.error('Error fetching survey status:', error);
    }
  };

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    if (type === 'code') {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } else {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleSurveyComplete = async () => {
    setShowSurveyModal(false);
    fetchSurveyStatus();
    // Refresh user data to update credits
    await refreshUser();
  };

  return (
    <div className="flex min-h-screen bg-gray-50 dark:gradient-bg">
      <Sidebar />
      
      <div className="flex-1 lg:ml-64 p-4 sm:p-6 md:p-8 mt-16 lg:mt-0">
        <div className="max-w-4xl mx-auto">
          {/* Page Header */}
          <div className="mb-6 sm:mb-8">
            <div className="flex items-center space-x-2 sm:space-x-3 mb-2">
              <Gift className="w-6 h-6 sm:w-8 sm:h-8 text-primary-500" />
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-gray-800 dark:text-white">Earn Free Credits</h1>
            </div>
          </div>

          {/* Quick Survey Section */}
          <div className="bg-white dark:bg-dark-900/50 dark:border-dark-700 rounded-xl sm:rounded-2xl border border-gray-200 p-4 sm:p-6 mb-6">
            <div className="flex items-start space-x-4">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                  <h3 className="text-lg font-bold text-gray-800 dark:text-white">Quick Survey (2 minutes)</h3>
                </div>
                <p className="text-gray-600 dark:text-gray-300 text-xs sm:text-sm mb-4">
                  Help us improve PromptVerse by sharing your feedback. You'll get{' '}
                  <span className="text-primary-400 font-semibold">50 free credits</span> instantly!
                </p>
                {!surveyStatus?.completed ? (
                  <button
                    onClick={() => setShowSurveyModal(true)}
                    className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-bold py-2.5 sm:py-3 px-4 sm:px-6 rounded-xl transition-all inline-flex items-center justify-center space-x-2 text-sm sm:text-base w-full sm:w-auto"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Take Survey</span>
                  </button>
                ) : (
                  <div className="inline-flex items-center space-x-2 bg-gray-100 dark:bg-dark-800 px-4 py-2 rounded-lg">
                    <Check className="w-5 h-5 text-green-400" />
                    <span className="text-green-400 font-medium">Survey Completed!</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Invite Colleagues Section */}
          <div className="bg-white dark:bg-dark-900/50 dark:border-dark-700 rounded-xl sm:rounded-2xl border border-gray-200 p-4 sm:p-6">
            <div className="flex items-center space-x-2 mb-4">
              <Users className="w-5 h-5 text-blue-400" />
              <h3 className="text-lg font-bold text-gray-800 dark:text-white">Invite Your Colleagues</h3>
            </div>
            <p className="text-gray-600 dark:text-gray-300 text-xs sm:text-sm mb-4 sm:mb-6">
              Share your referral link with colleagues and earn{' '}
              <span className="text-primary-400 font-semibold">10 free credits</span> for each person who signs up.
            </p>

            {referralData && (
              <>
                {/* Referral Code */}
                <div className="mb-4">
                  <label className="block text-gray-500 dark:text-gray-400 text-xs mb-2">Your Referral Code</label>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <div className="flex-1 bg-gray-100 dark:bg-dark-800 rounded-xl p-3 sm:p-4">
                      <span className="text-gray-800 dark:text-white font-mono text-base sm:text-lg font-bold break-all">
                        {referralData.referralCode}
                      </span>
                    </div>
                    <button
                      onClick={() => copyToClipboard(referralData.referralCode, 'code')}
                      className="bg-gray-100 dark:bg-dark-800 hover:bg-gray-200 dark:hover:bg-dark-700 p-3 sm:p-4 rounded-xl transition-all flex items-center justify-center"
                    >
                      {copiedCode ? (
                        <Check className="w-5 h-5 text-green-400" />
                      ) : (
                        <Copy className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Shareable Link */}
                <div className="mb-4 sm:mb-6">
                  <label className="block text-gray-500 dark:text-gray-400 text-xs mb-2">Shareable Link</label>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <div className="flex-1 bg-gray-100 dark:bg-dark-800 rounded-xl p-3 sm:p-4 overflow-hidden">
                      <span className="text-gray-800 dark:text-white text-xs sm:text-sm break-all">
                        {referralData.shareableLink}
                      </span>
                    </div>
                    <button
                      onClick={() => copyToClipboard(referralData.shareableLink, 'link')}
                      className="bg-gray-100 dark:bg-dark-800 hover:bg-gray-200 dark:hover:bg-dark-700 p-3 sm:p-4 rounded-xl transition-all flex items-center justify-center space-x-2"
                    >
                      {copiedLink ? (
                        <Check className="w-5 h-5 text-green-400" />
                      ) : (
                        <Copy className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                      )}
                      <span className="text-gray-600 dark:text-gray-300 text-xs sm:text-sm font-medium">Copy Link</span>
                    </button>
                  </div>
                </div>

                {/* Your Referrals */}
                <div className="bg-gray-100 dark:bg-dark-800 rounded-xl p-3 sm:p-4">
                  <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm">
                    {referralData.referralCount === 0
                      ? `No referrals yet. Share your code to start earning credits!`
                      : `You've referred ${referralData.referralCount} ${referralData.referralCount === 1 ? 'person' : 'people'}!`}
                  </p>
                </div>

                {/* How it Works */}
                <div className="mt-6 space-y-3">
                  <h4 className="text-gray-800 dark:text-white font-semibold">How it works</h4>
                  <div className="space-y-2">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-500/20 flex items-center justify-center mt-0.5">
                        <span className="text-primary-400 text-xs font-bold">1</span>
                      </div>
                      <p className="text-gray-600 dark:text-gray-300 text-sm">Share your referral code or link with colleagues</p>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-500/20 flex items-center justify-center mt-0.5">
                        <span className="text-primary-400 text-xs font-bold">2</span>
                      </div>
                      <p className="text-gray-600 dark:text-gray-300 text-sm">They sign up using your code</p>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-500/20 flex items-center justify-center mt-0.5">
                        <span className="text-primary-400 text-xs font-bold">3</span>
                      </div>
                      <p className="text-gray-600 dark:text-gray-300 text-sm">You get 10 free credits for each referral</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Survey Modal */}
      {showSurveyModal && (
        <SurveyModal
          onClose={() => setShowSurveyModal(false)}
          onComplete={handleSurveyComplete}
        />
      )}
    </div>
  );
};

export default EarnCredits;
