import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { getAuthHeaders } from '../services/api';
import Sidebar from '../components/Sidebar';
import { Search, Globe, X, Check } from 'lucide-react';
import Step2BrandAnalysis from '../components/Step2BrandAnalysis';
import Step3ReadyToAnalyze from '../components/Step3ReadyToAnalyze';
import AnalysisLoadingModal from '../components/AnalysisLoadingModal';
import SaveBrandModal from '../components/SaveBrandModal';
import InsufficientCreditsModal from '../components/InsufficientCreditsModal';

const Reports = () => {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [searchParams] = useSearchParams();
  const continueReportId = searchParams.get('continue');

  const [formData, setFormData] = useState({
    brandName: '',
    websiteUrl: '',
    searchScope: 'local', // 'local' or 'national'
    localSearchCity: 'Toronto, CA',
    targetCountry: 'CA',
    language: 'English',
    platforms: {
      perplexity: false,
      chatgpt: false,
      googleAiOverviews: false
    },
    brandFavicon: null
  });

  const [currentStep, setCurrentStep] = useState(1);
  const [isFetchingBrandInfo, setIsFetchingBrandInfo] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showBrandModal, setShowBrandModal] = useState(false);
  const [showSaveBrandModal, setShowSaveBrandModal] = useState(false);
  const [isSavingBrand, setIsSavingBrand] = useState(false);
  const [existingBrand, setExistingBrand] = useState(null);
  const [step2Data, setStep2Data] = useState(null);
  const [analysisProgress, setAnalysisProgress] = useState({ total: 0, completed: 0 });
  const [inProgressReportId, setInProgressReportId] = useState(null);
  const [savedBrandId, setSavedBrandId] = useState(null);
  const [showInsufficientCreditsModal, setShowInsufficientCreditsModal] = useState(false);
  const [creditsInfo, setCreditsInfo] = useState({ needed: 0, available: 0 });

  // Load in-progress report if continuing
  useEffect(() => {
    if (continueReportId) {
      loadInProgressReport(continueReportId);
    }
  }, [continueReportId]);

  const loadInProgressReport = async (reportId) => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    try {
      const response = await fetch(`${API_URL}/reports/${reportId}`, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      if (response.ok) {
        const { data: report } = await response.json();

        if (report.status === 'in-progress' && report.progress) {
          // Restore form data
          if (report.progress.formData) {
            setFormData(report.progress.formData);
          }

          // Restore step 2 data if exists
          if (report.progress.step2Data) {
            setStep2Data(report.progress.step2Data);
          }

          // Restore saved brand ID if exists
          if (report.brandId) {
            setSavedBrandId(report.brandId);
          }

          // Set current step
          setCurrentStep(report.progress.currentStep || 1);
          setInProgressReportId(reportId);
        }
      }
    } catch (error) {
      console.error('Error loading in-progress report:', error);
    }
  };

  const saveProgress = async (step, step2DataToSave = null, brandIdToSave = null) => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    try {
      const response = await fetch(`${API_URL}/reports/save-progress`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          reportId: inProgressReportId,
          brandData: {
            brandId: brandIdToSave || savedBrandId, // Use passed brandId or state
            brandName: formData.brandName,
            websiteUrl: formData.websiteUrl,
            favicon: formData.brandFavicon,
            searchScope: formData.searchScope,
            location: formData.searchScope === 'local' ? formData.localSearchCity.split(',')[0].trim() : null,
            country: formData.searchScope === 'local' ? formData.localSearchCity.split(',')[1]?.trim() || formData.targetCountry : formData.targetCountry,
            language: formData.language,
            platforms: formData.platforms,
          },
          currentStep: step,
          formData: formData,
          step2Data: step2DataToSave || step2Data,
        }),
      });

      if (response.ok) {
        const { data: savedReport } = await response.json();
        if (!inProgressReportId) {
          setInProgressReportId(savedReport._id);
        }
      }
    } catch (error) {
      console.error('Error saving progress:', error);
    }
  };

  const countries = [
    { code: 'CA', name: 'Canada' },
    { code: 'IN', name: 'India' },
    { code: 'US', name: 'United States' },
    { code: 'GB', name: 'United Kingdom' },
    { code: 'AU', name: 'Australia' },
    { code: 'DE', name: 'Germany' },
    { code: 'FR', name: 'France' },
    { code: 'JP', name: 'Japan' },
    { code: 'BR', name: 'Brazil' },
    { code: 'MX', name: 'Mexico' },
    { code: 'IT', name: 'Italy' },
    { code: 'ES', name: 'Spain' },
    { code: 'NL', name: 'Netherlands' },
    { code: 'SE', name: 'Sweden' },
    { code: 'CH', name: 'Switzerland' },
    { code: 'SG', name: 'Singapore' },
    { code: 'AE', name: 'United Arab Emirates' },
    { code: 'ZA', name: 'South Africa' },
    { code: 'AR', name: 'Argentina' },
    { code: 'CL', name: 'Chile' },
    { code: 'CO', name: 'Colombia' },
    { code: 'PE', name: 'Peru' },
    { code: 'UA', name: 'Ukraine' },
    { code: 'UG', name: 'Uganda' },
    { code: 'KE', name: 'Kenya' },
    { code: 'NG', name: 'Nigeria' },
    { code: 'EG', name: 'Egypt' },
    { code: 'PK', name: 'Pakistan' },
    { code: 'BD', name: 'Bangladesh' },
    { code: 'VN', name: 'Vietnam' },
    { code: 'TH', name: 'Thailand' },
    { code: 'MY', name: 'Malaysia' },
    { code: 'PH', name: 'Philippines' },
    { code: 'ID', name: 'Indonesia' },
    { code: 'KR', name: 'South Korea' },
    { code: 'TW', name: 'Taiwan' },
    { code: 'HK', name: 'Hong Kong' },
    { code: 'NZ', name: 'New Zealand' },
  ];

  const languages = [
    'English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese',
    'Dutch', 'Russian', 'Chinese', 'Japanese', 'Korean', 'Arabic',
    'Hindi', 'Bengali', 'Turkish', 'Polish', 'Vietnamese', 'Thai'
  ];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePlatformChange = (platform) => {
    setFormData(prev => ({
      ...prev,
      platforms: {
        ...prev.platforms,
        [platform]: !prev.platforms[platform]
      }
    }));
  };

  const fetchFavicon = async (url) => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

      const response = await fetch(`${API_URL}/brand/favicon?url=${encodeURIComponent(url)}`, {
        method: 'GET',
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      const data = await response.json();

      if (data.success) {
        return data.faviconUrl;
      } else {
        // Fallback to Google's favicon service
        const domain = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
      }
    } catch (error) {
      console.error('Error fetching favicon:', error);
      // Fallback to Google's favicon service
      try {
        const domain = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
      } catch {
        return null;
      }
    }
  };

  const handleAnalyzeBrand = async () => {
    if (!formData.brandName || !formData.websiteUrl) {
      toast.error('Please fill in Brand Name and Website URL');
      return;
    }

    setIsFetchingBrandInfo(true);

    // Fetch favicon
    const favicon = await fetchFavicon(formData.websiteUrl);
    setFormData(prev => ({ ...prev, brandFavicon: favicon }));
    setIsFetchingBrandInfo(false);

    // Show save brand modal
    setShowSaveBrandModal(true);
  };

  const handleSaveBrand = async () => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    setIsSavingBrand(true);

    try {
      const response = await fetch(`${API_URL}/brand/save`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          brandName: formData.brandName,
          websiteUrl: formData.websiteUrl,
          favicon: formData.brandFavicon,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        const { data: savedBrand } = data;
        setSavedBrandId(savedBrand._id);

        toast.success('Brand saved successfully!');

        // Pass brandId directly to saveProgress to avoid state timing issues
        setShowSaveBrandModal(false);
        setCurrentStep(2);
        await saveProgress(2, null, savedBrand._id);
      } else {
        const errorMessage = data.message || 'Failed to save brand. Please try again.';
        toast.error(errorMessage);
        console.error('Failed to save brand:', errorMessage);
        // Keep modal open on error so user can retry
      }
    } catch (error) {
      const errorMessage = error.message || 'Network error. Please check your connection and try again.';
      toast.error(errorMessage);
      console.error('Error saving brand:', error);
      // Keep modal open on error so user can retry
    } finally {
      setIsSavingBrand(false);
    }
  };

  const handleSkipSaveBrand = () => {
    setShowSaveBrandModal(false);
    setCurrentStep(2);
    saveProgress(2);
  };

  const handleStep2Complete = (data) => {
    setStep2Data(data);
    setCurrentStep(3);
    saveProgress(3, data);
  };

  const handleAnalyzeVisibility = async (finalPrompts) => {
    try {
      // Check if user has enough credits
      const promptsCount = finalPrompts.length;
      if (user && user.credits < promptsCount) {
        setCreditsInfo({
          needed: promptsCount,
          available: user.credits,
        });
        setShowInsufficientCreditsModal(true);
        return;
      }

      setIsAnalyzing(true);

      // Get selected AI models from platforms
      const selectedAiModels = [];
      if (formData.platforms.chatgpt) selectedAiModels.push('chatgpt');
      if (formData.platforms.perplexity) selectedAiModels.push('perplexity');
      if (formData.platforms.googleAiOverviews) selectedAiModels.push('google_ai_overview');

      if (selectedAiModels.length === 0) {
        toast.error('Please select at least one AI platform (ChatGPT, Perplexity, or Google AI Overview)');
        setIsAnalyzing(false);
        return;
      }

      // Clean brand URL - remove protocol, www, paths, and query params
      const cleanBrandUrl = (url) => {
        try {
          // Remove protocol if present
          let cleaned = url.replace(/^(https?:\/\/)?(www\.)?/, '');
          // Remove path and query params
          cleaned = cleaned.split('/')[0].split('?')[0];
          return cleaned;
        } catch (error) {
          return url;
        }
      };

      const cleanedBrandUrl = cleanBrandUrl(formData.websiteUrl);

      const N8N_WEBHOOK_URL = import.meta.env.VITE_N8N_WEBHOOK_URL;
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

      // Generate authentication token for n8n webhook
      const tokenResponse = await fetch(`${API_URL}/analysis/generate-webhook-token`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      if (!tokenResponse.ok) {
        throw new Error('Failed to generate authentication token');
      }

      const { data: { token } } = await tokenResponse.json();

      const totalJobs = finalPrompts.length;


      // Determine location and country based on search scope
      let location = null;
      let country = null;

      if (formData.searchScope === 'local') {
        const parts = formData.localSearchCity.split(',').map(p => p.trim());
        location = parts[0]; // City name
        country = parts[1] || formData.targetCountry; // Country code (2 letters)
      } else {
        location = null;
        country = formData.targetCountry; // 2-letter country code
      }

      const promptsSentPayloads = finalPrompts.map((prompt, index) => ({
        prompt: prompt.text,
        category: prompt.category,
        brand: formData.brandName,
        brandUrl: cleanedBrandUrl,
        brandId: savedBrandId, // Include brandId
        chatgpt: formData.platforms.chatgpt,
        perplexity: formData.platforms.perplexity,
        google_ai_overviews: formData.platforms.googleAiOverviews,
        location,
        country,
        promptIndex: index,
        status: 'sent',
      }));

      // Set initial progress
      setAnalysisProgress({ total: totalJobs, completed: 0 });

      // Send ALL requests in parallel using Promise.all
      const n8nPromises = finalPrompts.map((prompt, index) => {
        const payload = promptsSentPayloads[index];

        return fetch(N8N_WEBHOOK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            prompt: payload.prompt,
            brand: payload.brand,
            brandUrl: payload.brandUrl,
            chatgpt: payload.chatgpt,
            perplexity: payload.perplexity,
            google_ai_overviews: payload.google_ai_overviews,
            location: payload.location,
            country: payload.country,
          }),
        })
          .then(async (response) => {
            const data = await response.json().catch(() => null);
            // Update progress
            setAnalysisProgress(prev => ({ ...prev, completed: prev.completed + 1 }));

            return {
              prompt: payload.prompt,
              category: payload.category,
              success: response.ok,
              status: response.status,
              response: data,
              promptIndex: payload.promptIndex,
            };
          })
          .catch((error) => {
            console.log(`[${index + 1}/${totalJobs}] Error: ${error.message}`);

            // Update progress even on error
            setAnalysisProgress(prev => ({ ...prev, completed: prev.completed + 1 }));

            return {
              prompt: payload.prompt,
              category: payload.category,
              success: false,
              error: error.message,
              promptIndex: payload.promptIndex,
            };
          });
      });


      // Wait for ALL requests to complete
      const results = await Promise.all(n8nPromises);

      try {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const promptsResponsesPayloads = results.map((result, index) => ({
          prompt: result.prompt,
          category: result.category,
          success: result.success,
          status: result.status ?? null,
          response: result.response,
          error: result.error ?? null,
          promptIndex: typeof result.promptIndex === 'number' ? result.promptIndex : index,
        }));

        const saveResponse = await fetch(`${API_URL}/reports/save`, {
          method: 'POST',
          headers: getAuthHeaders(),
          credentials: 'include',
          body: JSON.stringify({
            inProgressReportId: inProgressReportId, // Pass the in-progress report ID if it exists
            brandId: savedBrandId, // Pass the brand ID if brand was saved
            brandData: {
              brandName: formData.brandName,
              websiteUrl: cleanedBrandUrl,
              favicon: formData.brandFavicon,
              searchScope: formData.searchScope,
              location: location,
              country: country,
              language: formData.language,
              platforms: formData.platforms,
            },
            reportData: results,
            promptsSent: promptsSentPayloads,
            promptsResponses: promptsResponsesPayloads,
            promptsCount: finalPrompts.length, // Add prompts count for credit deduction
          }),
        });

        if (saveResponse.ok) {
          const { data: savedReport } = await saveResponse.json();

          // Refresh user data to update credits in sidebar
          await refreshUser();

          // Navigate to report view with saved report ID
          navigate(`/reports/${savedReport._id}`);
        } else {
          console.error('Failed to save report');
          // Still navigate to view with in-memory data
          navigate('/reports/view', {
            state: {
              reportData: results,
              brandData: {
                brandName: formData.brandName,
                websiteUrl: cleanedBrandUrl,
                searchScope: formData.searchScope,
                location: location,
                country: country,
                platforms: formData.platforms,
              },
            },
          });
        }
      } catch (saveError) {
        console.error('Error saving report:', saveError);
        // Still navigate to view with in-memory data
        navigate('/reports/view', {
          state: {
            reportData: results,
            brandData: {
              brandName: formData.brandName,
              websiteUrl: cleanedBrandUrl,
              searchScope: formData.searchScope,
              location: location,
              country: country,
              platforms: formData.platforms,
            },
          },
        });
      }

      setIsAnalyzing(false);

    } catch (error) {
      console.error('Error:', error);
      toast.error(`Error: ${error.message}`);
      setIsAnalyzing(false);
    }
  };

  const handleStartOver = () => {
    setCurrentStep(1);
    setFormData({
      brandName: '',
      websiteUrl: '',
      searchScope: 'local',
      localSearchCity: 'Toronto, CA',
      targetCountry: 'CA',
      language: 'English',
      platforms: {
        perplexity: false,
        chatgpt: false,
        googleAiOverviews: false
      },
      brandFavicon: null
    });
    setStep2Data(null);
  };

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-dark-950">
      <Sidebar />

      <div className="flex-1 lg:ml-64 p-4 sm:p-6 md:p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-6 sm:mb-8 mt-16 lg:mt-0">
            <div className="px-4 sm:px-6 md:px-8 lg:px-0">
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-gray-800 dark:text-white mb-3 sm:mb-4">
                Check Your Client's Visibility
              </h1>
              <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black mb-3 sm:mb-4">
                <span className="gradient-text">in AI Assistants</span>
              </h2>
              <p className="text-gray-600 text-xs mt-2">
                Find out if ChatGPT recommends your client - and what to do if it doesn't.
              </p>
            </div>
          </div>

          {/* Step Indicators */}
          <div className="flex items-center justify-center mb-8 sm:mb-12 overflow-x-auto px-2">
            <div className="flex items-center space-x-2 sm:space-x-4 min-w-max">
              {/* Step 1 */}
              <div className="flex items-center">
                <div className={`flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 transition-all ${currentStep === 1
                  ? 'bg-primary-500 border-primary-500 text-white'
                  : currentStep > 1
                    ? 'bg-green-500 border-green-500 text-white'
                    : 'border-gray-300 dark:border-dark-600 text-gray-500 dark:text-gray-400'
                  }`}>
                  {currentStep > 1 ? <Check className="w-4 h-4 sm:w-5 sm:h-5" /> : '1'}
                </div>
                <span className={`ml-1 sm:ml-2 text-xs sm:text-sm font-medium hidden sm:inline ${currentStep >= 1 ? 'text-gray-800 dark:text-gray-200' : 'text-gray-500 dark:text-gray-400'
                  }`}>
                  Brand Details
                </span>
              </div>

              {/* Connector */}
              <div className={`w-8 sm:w-16 h-0.5 ${currentStep > 1 ? 'bg-green-500' : 'bg-gray-300 dark:bg-dark-700'
                }`}></div>

              {/* Step 2 */}
              <div className="flex items-center">
                <div className={`flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 transition-all ${currentStep === 2
                  ? 'bg-primary-500 border-primary-500 text-white'
                  : currentStep > 2
                    ? 'bg-green-500 border-green-500 text-white'
                    : 'border-gray-300 dark:border-dark-600 text-gray-500 dark:text-gray-400'
                  }`}>
                  {currentStep > 2 ? <Check className="w-4 h-4 sm:w-5 sm:h-5" /> : '2'}
                </div>
                <span className={`ml-1 sm:ml-2 text-xs sm:text-sm font-medium hidden sm:inline ${currentStep >= 2 ? 'text-gray-800 dark:text-gray-200' : 'text-gray-500 dark:text-gray-400'
                  }`}>
                  Generate Prompts
                </span>
              </div>

              {/* Connector */}
              <div className={`w-16 h-0.5 ${currentStep > 2 ? 'bg-green-500' : 'bg-gray-300 dark:bg-dark-700'
                }`}></div>

              {/* Step 3 */}
              <div className="flex items-center">
                <div className={`flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 transition-all ${currentStep === 3
                  ? 'bg-primary-500 border-primary-500 text-white'
                  : 'border-gray-300 dark:border-dark-600 text-gray-500 dark:text-gray-400'
                  }`}>
                  3
                </div>
                <span className={`ml-1 sm:ml-2 text-xs sm:text-sm font-medium hidden sm:inline ${currentStep >= 3 ? 'text-gray-800 dark:text-gray-200' : 'text-gray-500 dark:text-gray-400'
                  }`}>
                  Test Visibility
                </span>
              </div>
            </div>
          </div>

          {/* Step 1: Brand Details Form */}
          {currentStep === 1 && (
            <div className="bg-white dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8">
              <div className="space-y-4 sm:space-y-6">
                {/* Brand Name */}
                <div>
                  <label className="block text-gray-700 dark:text-gray-300 text-sm font-medium mb-2">
                    Brand Name
                  </label>
                  <input
                    type="text"
                    name="brandName"
                    value={formData.brandName}
                    onChange={handleInputChange}
                    placeholder="PromptVerse"
                    className="w-full px-4 py-3 bg-white dark:bg-dark-800 rounded-xl border border-gray-300 dark:border-dark-600 focus:border-action-500 focus:outline-none focus:ring-2 focus:ring-action-200 dark:focus:ring-action-500/50 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                  />
                </div>

                {/* Website URL */}
                <div>
                  <label className="block text-gray-700 dark:text-gray-300 text-sm font-medium mb-2">
                    Website URL
                  </label>
                  <input
                    type="url"
                    name="websiteUrl"
                    value={formData.websiteUrl}
                    onChange={handleInputChange}
                    placeholder="www.promptverse.com"
                    className="w-full px-4 py-3 bg-white dark:bg-dark-800 rounded-xl border border-gray-300 dark:border-dark-600 focus:border-action-500 focus:outline-none focus:ring-2 focus:ring-action-200 dark:focus:ring-action-500/50 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                  />
                  <p className="text-gray-600 dark:text-gray-400 text-xs mt-2">
                    Just drop your domain here, we'll fetch try all
                  </p>
                </div>

                {/* Prompt/Search Scope */}
                <div>
                  <label className="block text-gray-700 dark:text-gray-300 text-sm font-medium mb-2">
                    Prompt/Search Scope
                  </label>
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                    <button
                      onClick={() => setFormData(prev => ({ ...prev, searchScope: 'local' }))}
                      className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 rounded-xl transition-all ${formData.searchScope === 'local'
                        ? 'bg-action-600 text-white'
                        : 'bg-gray-100 dark:bg-dark-800 border border-gray-300 dark:border-dark-600 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-700'
                        }`}
                    >
                      <Search className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span className="text-sm sm:text-base font-medium">Local Search</span>
                    </button>
                    <button
                      onClick={() => setFormData(prev => ({ ...prev, searchScope: 'national' }))}
                      className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 rounded-xl transition-all ${formData.searchScope === 'national'
                        ? 'bg-action-600 text-white'
                        : 'bg-gray-100 dark:bg-dark-800 border border-gray-300 dark:border-dark-600 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-700'
                        }`}
                    >
                      <Globe className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span className="text-sm sm:text-base font-medium">National Search</span>
                    </button>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 text-xs mt-2">
                    {formData.searchScope === 'local'
                      ? "Target customers in your city or region (e.g., 'Best dentist in Dallas')"
                      : 'Target customers nationwide. Use this marketing approach'}
                  </p>
                </div>

                {/* Local Search - City Input */}
                {formData.searchScope === 'local' && (
                  <div>
                    <label className="block text-gray-700 dark:text-gray-300 text-sm font-medium mb-2">
                      City & Country Code
                    </label>
                    <input
                      type="text"
                      name="localSearchCity"
                      value={formData.localSearchCity}
                      onChange={handleInputChange}
                      placeholder="e.g., Toronto, CA or New York, US"
                      className="w-full px-4 py-3 bg-white dark:bg-dark-800 rounded-xl border border-gray-300 dark:border-dark-600 focus:border-action-500 focus:outline-none focus:ring-2 focus:ring-action-200 dark:focus:ring-action-500/50 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                    />
                    <p className="text-gray-600 dark:text-gray-400 text-xs mt-2">
                      Just drop your domain here, we'll fetch try all
                    </p>
                  </div>
                )}

                {/* National Search - Country Dropdown */}
                {formData.searchScope === 'national' && (
                  <div>
                    <label className="block text-gray-700 dark:text-gray-300 text-sm font-medium mb-2">
                      Target Country
                    </label>
                    <select
                      name="targetCountry"
                      value={formData.targetCountry}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 bg-white dark:bg-dark-800 rounded-xl border border-gray-300 dark:border-dark-600 focus:border-action-500 focus:outline-none focus:ring-2 focus:ring-action-200 dark:focus:ring-action-500/50 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 transition-all appearance-none cursor-pointer"
                    >
                      {countries.map((country) => (
                        <option key={country.code} value={country.code} className="bg-white dark:bg-dark-800 text-gray-800 dark:text-gray-200">
                          {country.name}, {country.code}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Language */}
                <div>
                  <label className="block text-gray-700 dark:text-gray-300 text-sm font-medium mb-2">
                    Language
                  </label>
                  <select
                    name="language"
                    value={formData.language}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-white dark:bg-dark-800 border border-gray-300 dark:border-dark-600 rounded-xl text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-action-200 dark:focus:ring-action-500/50 transition-all appearance-none cursor-pointer"
                  >
                    {languages.map((lang) => (
                      <option key={lang} value={lang} className="bg-white dark:bg-dark-800 text-gray-800 dark:text-gray-200">
                        {lang}
                      </option>
                    ))}
                  </select>
                </div>

                {/* AI Platforms */}
                <div>
                  <label className="block text-gray-700 dark:text-gray-300 text-sm font-medium mb-3">
                    AI Platforms
                  </label>
                  <div className="space-y-3">
                    <label className="flex items-center space-x-3 cursor-pointer group">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={formData.platforms.perplexity}
                          onChange={() => handlePlatformChange('perplexity')}
                          className="sr-only"
                        />
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${formData.platforms.perplexity
                          ? 'bg-action-600 border-action-600'
                          : 'border-gray-300 dark:border-dark-600 group-hover:border-gray-400 dark:group-hover:border-dark-500 bg-white dark:bg-dark-800'
                          }`}>
                          {formData.platforms.perplexity && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <img
                          src="https://www.google.com/s2/favicons?domain=perplexity.ai&sz=32"
                          alt="Perplexity"
                          className="w-4 h-4"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                        <span className={`group-hover:text-gray-800 dark:group-hover:text-white transition-colors ${formData.platforms.perplexity ? 'text-gray-800 dark:text-white' : 'text-gray-700 dark:text-gray-300'
                          }`}>
                          Perplexity
                        </span>
                      </div>
                    </label>

                    <label className="flex items-center space-x-3 cursor-pointer group">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={formData.platforms.chatgpt}
                          onChange={() => handlePlatformChange('chatgpt')}
                          className="sr-only"
                        />
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${formData.platforms.chatgpt
                          ? 'bg-action-600 border-action-600'
                          : 'border-gray-300 dark:border-dark-600 group-hover:border-gray-400 dark:group-hover:border-dark-500'
                          }`}>
                          {formData.platforms.chatgpt && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <img
                          src="https://cdn.oaistatic.com/assets/favicon-o20kmmos.svg"
                          alt="ChatGPT"
                          className="w-4 h-4"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                        <span className={`text-gray-700 dark:text-gray-300 group-hover:text-gray-800 dark:group-hover:text-white transition-colors`}>
                          ChatGPT
                        </span>
                      </div>
                    </label>

                    <label className="flex items-center space-x-3 cursor-pointer group">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={formData.platforms.googleAiOverviews}
                          onChange={() => handlePlatformChange('googleAiOverviews')}
                          className="sr-only"
                        />
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${formData.platforms.googleAiOverviews
                          ? 'bg-action-600 border-action-600'
                          : 'border-gray-300 dark:border-dark-600 group-hover:border-gray-400 dark:group-hover:border-dark-500 bg-white dark:bg-dark-800'
                          }`}>
                          {formData.platforms.googleAiOverviews && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <img
                          src="https://www.google.com/s2/favicons?domain=google.com&sz=32"
                          alt="Google AI Overviews"
                          className="w-4 h-4"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                        <span className={`group-hover:text-gray-800 dark:group-hover:text-white transition-colors ${formData.platforms.googleAiOverviews ? 'text-gray-800 dark:text-white' : 'text-gray-700 dark:text-gray-300'
                          }`}>
                          Google AI Overviews
                        </span>
                      </div>
                    </label>
                  </div>

                  <div className="mt-4 p-3 bg-purple-50 dark:bg-purple-500/10 rounded-lg">
                    <p className="text-purple-600 dark:text-purple-400 text-xs">
                      <span className="font-semibold">💎 Google AI Overview</span>
                    </p>
                    <p className="text-gray-600 dark:text-gray-400 text-xs mt-1">
                      Use it to evaluate & optimize against Google AI Overviews or get ranked.
                    </p>
                  </div>
                </div>

                {/* Favicon Preview - Hidden from clients */}
                {formData.brandFavicon && (
                  <div className="hidden">
                    <img
                      src={formData.brandFavicon}
                      alt="Brand Favicon"
                      className="w-8 h-8 rounded"
                    />
                  </div>
                )}

                {/* Analyze Button */}
                <button
                  onClick={handleAnalyzeBrand}
                  disabled={isFetchingBrandInfo}
                  className="w-full bg-action-600 text-white font-bold py-4 px-6 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center space-x-2 hover:bg-action-700"
                >
                  <Search className="w-5 h-5" />
                  <span>{isFetchingBrandInfo ? 'Analyzing Brand...' : 'Analyze Brand'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Brand Analysis */}
          {currentStep === 2 && (
            <Step2BrandAnalysis
              brandData={formData}
              onComplete={handleStep2Complete}
              onBack={() => setCurrentStep(1)}
            />
          )}

          {/* Step 3: Ready to Analyze */}
          {currentStep === 3 && step2Data && (
            <Step3ReadyToAnalyze
              brandData={formData}
              step2Data={step2Data}
              onAnalyze={handleAnalyzeVisibility}
              onBack={() => setCurrentStep(2)}
              onStartOver={handleStartOver}
            />
          )}
        </div>
      </div>

      {/* Existing Brand Modal */}
      {showBrandModal && existingBrand && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/25 backdrop-blur-sm">
          <div className="bg-white dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 w-sm w-full shadow-2xl animate-slide-up">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200">Existing Brand Found</h3>
              <button
                onClick={() => setShowBrandModal(false)}
                className="p-1 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white" />
              </button>
            </div>

            {/* Brand Info */}
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
                {existingBrand.favicon ? (
                  <img
                    src={existingBrand.favicon}
                    alt={existingBrand.name}
                    className="w-12 h-12 rounded-lg"
                  />
                ) : (
                  <span className="text-3xl">📦</span>
                )}
              </div>

              <p className="text-gray-800 dark:text-gray-200 mb-2">
                We notice you already have a saved brand named{' '}
                <span className="text-gray-900 dark:text-white font-semibold">{existingBrand.name}</span>
              </p>

              <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">
                Website: <span className="text-gray-900 dark:text-white">{existingBrand.website}</span>
              </p>

              <p className="text-gray-800 dark:text-gray-200 mt-4">
                Do you want to add this report to this brand?
              </p>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button
                onClick={() => {
                  // Handle adding report to existing brand
                  setShowBrandModal(false);
                  // You'll integrate with your n8n agent here
                }}
                className="w-full bg-action-600 hover:bg-action-700 text-white font-bold py-3 px-6 rounded-xl transition-all flex items-center justify-center space-x-2"
              >
                <span>Yes, add to this brand</span>
              </button>

              <button
                onClick={() => {
                  // Handle experimenting without saving
                  setShowBrandModal(false);
                  // Continue with analysis
                }}
                className="w-full bg-gray-100 dark:bg-dark-800 hover:bg-gray-200 dark:hover:bg-dark-700 text-gray-800 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white font-medium py-3 px-6 rounded-xl transition-all flex items-center justify-center space-x-2"
              >
                <span>🔬 No, just experimenting</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Brand Modal */}
      <SaveBrandModal
        isOpen={showSaveBrandModal}
        onClose={handleSkipSaveBrand}
        brandData={{
          brandName: formData.brandName,
          websiteUrl: formData.websiteUrl,
          favicon: formData.brandFavicon
        }}
        onSave={handleSaveBrand}
        onSkip={handleSkipSaveBrand}
        isLoading={isSavingBrand}
      />

      {/* Analysis Loading Modal */}
      <AnalysisLoadingModal
        isOpen={isAnalyzing}
        totalPrompts={analysisProgress.total}
        completedPrompts={analysisProgress.completed}
      />

      {/* Insufficient Credits Modal */}
      <InsufficientCreditsModal
        isOpen={showInsufficientCreditsModal}
        onClose={() => setShowInsufficientCreditsModal(false)}
        creditsNeeded={creditsInfo.needed}
        creditsAvailable={creditsInfo.available}
      />
    </div>
  );
};

export default Reports;
