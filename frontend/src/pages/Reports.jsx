import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import { Search, Globe, X, Check } from 'lucide-react';
import Step2BrandAnalysis from '../components/Step2BrandAnalysis';
import Step3ReadyToAnalyze from '../components/Step3ReadyToAnalyze';

const Reports = () => {
  const [formData, setFormData] = useState({
    brandName: '',
    websiteUrl: '',
    searchScope: 'local', // 'local' or 'national'
    localSearchCity: 'Delhi, IN',
    targetCountry: 'IN',
    language: 'English',
    platforms: {
      perplexity: false,
      chatgpt: false,
      googleAiOverviews: false
    },
    brandFavicon: null
  });

  const [currentStep, setCurrentStep] = useState(1);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showBrandModal, setShowBrandModal] = useState(false);
  const [existingBrand, setExistingBrand] = useState(null);
  const [step2Data, setStep2Data] = useState(null);

  const countries = [
    { code: 'IN', name: 'India' },
    { code: 'US', name: 'United States' },
    { code: 'GB', name: 'United Kingdom' },
    { code: 'CA', name: 'Canada' },
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
      alert('Please fill in Brand Name and Website URL');
      return;
    }

    setIsAnalyzing(true);
    
    // Fetch favicon
    const favicon = await fetchFavicon(formData.websiteUrl);
    setFormData(prev => ({ ...prev, brandFavicon: favicon }));

    // Move to step 2
    setIsAnalyzing(false);
    setCurrentStep(2);
  };

  const handleStep2Complete = (data) => {
    setStep2Data(data);
    setCurrentStep(3);
  };

  const handleAnalyzeVisibility = async (finalPrompts) => {
    try {
      setIsAnalyzing(true);
      
      // Get selected AI models from platforms
      const selectedAiModels = [];
      if (formData.platforms.chatgpt) selectedAiModels.push('chatgpt');
      if (formData.platforms.perplexity) selectedAiModels.push('perplexity');
      if (formData.platforms.googleAiOverviews) selectedAiModels.push('google_ai_overview');

      if (selectedAiModels.length === 0) {
        alert('Please select at least one AI platform (ChatGPT, Perplexity, or Google AI Overview)');
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

      const N8N_WEBHOOK_URL = 'https://n8n.srv883399.hstgr.cloud/webhook-test/bfc97a52-cf33-4b41-976b-dffacac20c27';
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      
      // Generate authentication token for n8n webhook
      console.log('🔐 Generating authentication token...');
      const tokenResponse = await fetch(`${API_URL}/analysis/generate-webhook-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!tokenResponse.ok) {
        throw new Error('Failed to generate authentication token');
      }

      const { data: { token } } = await tokenResponse.json();
      console.log('✅ Authentication token generated');

      const totalJobs = finalPrompts.length;
      const totalCalls = totalJobs * 2; // n8n-proxy + tracker per prompt

      console.log('\n' + '='.repeat(80));
      console.log(`🚀 STARTING ANALYSIS - CHECK CHROME NETWORK TAB`);
      console.log('='.repeat(80));
      console.log(`Brand: ${formData.brandName}`);
      console.log(`Prompts: ${finalPrompts.length}`);
      console.log(`AI Models: ${selectedAiModels.join(', ')}`);
      console.log(`Total Jobs: ${totalJobs}`);
      console.log(`n8n-proxy calls (POST): ${totalJobs}`);
      console.log(`tracker calls (POST): ${totalJobs}`);
      console.log(`TOTAL API CALLS: ${totalCalls}`);
      console.log(`🔐 Authentication: JWT Bearer token`);
      console.log('='.repeat(80) + '\n');

      let completedJobs = 0;
      const results = [];

      // Process each prompt (all models sent together as booleans)
      for (const prompt of finalPrompts) {
        completedJobs++;
        
        console.log(`\n[${completedJobs}/${totalJobs}] Processing:`);
        console.log(`  Prompt: "${prompt.text.substring(0, 60)}..."`);
        console.log(`  Brand: ${formData.brandName}`);
        console.log(`  Models: ${selectedAiModels.join(', ')}`);

        try {
          // Determine location and country based on search scope
          let location = null;
          let country = null;

          if (formData.searchScope === 'local') {
            // For local: extract city and country from localSearchCity (e.g., "Delhi, IN")
            const parts = formData.localSearchCity.split(',').map(p => p.trim());
            location = parts[0]; // City name
            country = parts[1] || formData.targetCountry; // Country code (2 letters)
          } else {
            // For national: location is null, country is targetCountry
            location = null;
            country = formData.targetCountry; // 2-letter country code
          }

          // CALL 1: n8n-proxy (POST with body - all models as booleans)
          console.log(`  → [n8n-proxy] POST to n8n webhook...`);
          console.log(`  Brand URL: ${cleanedBrandUrl}`);
          console.log(`  Location: ${location || 'null'}, Country: ${country}`);
          console.log(`  🔐 Using Bearer token for authentication`);
          
          const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              prompt: prompt.text,
              brand: formData.brandName,
              brandUrl: cleanedBrandUrl,
              chatgpt: formData.platforms.chatgpt,
              perplexity: formData.platforms.perplexity,
              google_ai_overviews: formData.platforms.googleAiOverviews,
              location: location,
              country: country,
            }),
          });

          const n8nData = await n8nResponse.json().catch(() => null);
          console.log(`  ✓ n8n-proxy responded: ${n8nResponse.status}`);

          // CALL 2: tracker (POST to check response)
          console.log(`  → [tracker] POST to verify n8n response...`);
          const trackerResponse = await fetch(N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              check: 'status',
              jobId: completedJobs,
            }),
          });

          const hasValidResponse = n8nResponse.ok && n8nData;
          console.log(`  ✓ tracker: ${hasValidResponse ? 'valid response ✓' : 'failed ✗'}`);

          results.push({
            prompt: prompt.text,
            category: prompt.category,
            models: selectedAiModels,
            success: hasValidResponse,
            n8nResponse: n8nData,
          });

        } catch (error) {
          console.log(`  ✗ Error: ${error.message}`);
          results.push({
            prompt: prompt.text,
            category: prompt.category,
            models: selectedAiModels,
            success: false,
            error: error.message,
          });
        }
      }

      console.log('\n' + '='.repeat(80));
      console.log(`✅ ANALYSIS COMPLETE`);
      console.log('='.repeat(80));
      console.log(`Total calls made: ${totalCalls}`);
      console.log(`Successful: ${results.filter(r => r.success).length}`);
      console.log(`Failed: ${results.filter(r => !r.success).length}`);
      console.log('='.repeat(80) + '\n');

      alert(`✅ Analysis Complete!\n\nTotal API calls: ${totalCalls}\nSuccessful: ${results.filter(r => r.success).length}\nFailed: ${results.filter(r => !r.success).length}\n\nCheck Chrome Network tab for all HTTP requests!`);
      setIsAnalyzing(false);

    } catch (error) {
      console.error('❌ Error:', error);
      alert(`Error: ${error.message}`);
      setIsAnalyzing(false);
    }
  };

  const handleStartOver = () => {
    setCurrentStep(1);
    setFormData({
      brandName: '',
      websiteUrl: '',
      searchScope: 'local',
      localSearchCity: 'Delhi, IN',
      targetCountry: 'IN',
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
    <div className="flex min-h-screen gradient-bg">
      <Sidebar />
      
      <div className="flex-1 ml-64 p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl font-black text-white mb-4">
              Check Your Client's Visibility
            </h1>
            <h2 className="text-3xl md:text-4xl font-black mb-4">
              <span className="gradient-text">in AI Assistants</span>
            </h2>
            <p className="text-gray-400 text-sm">
              Find out if ChatGPT recommends your client - and what to do if it doesn't.
            </p>
          </div>

          {/* Step Indicators */}
          <div className="flex items-center justify-center mb-12">
            <div className="flex items-center space-x-4">
              {/* Step 1 */}
              <div className="flex items-center">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all ${
                  currentStep === 1 
                    ? 'bg-primary-500 border-primary-500 text-white'
                    : currentStep > 1
                    ? 'bg-green-500 border-green-500 text-white'
                    : 'border-gray-600 text-gray-600'
                }`}>
                  {currentStep > 1 ? <Check className="w-5 h-5" /> : '1'}
                </div>
                <span className={`ml-2 text-sm font-medium ${
                  currentStep >= 1 ? 'text-white' : 'text-gray-600'
                }`}>
                  Brand Details
                </span>
              </div>

              {/* Connector */}
              <div className={`w-16 h-0.5 ${
                currentStep > 1 ? 'bg-green-500' : 'bg-gray-600'
              }`}></div>

              {/* Step 2 */}
              <div className="flex items-center">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all ${
                  currentStep === 2 
                    ? 'bg-primary-500 border-primary-500 text-white'
                    : currentStep > 2
                    ? 'bg-green-500 border-green-500 text-white'
                    : 'border-gray-600 text-gray-600'
                }`}>
                  {currentStep > 2 ? <Check className="w-5 h-5" /> : '2'}
                </div>
                <span className={`ml-2 text-sm font-medium ${
                  currentStep >= 2 ? 'text-white' : 'text-gray-600'
                }`}>
                  Generate Prompts
                </span>
              </div>

              {/* Connector */}
              <div className={`w-16 h-0.5 ${
                currentStep > 2 ? 'bg-green-500' : 'bg-gray-600'
              }`}></div>

              {/* Step 3 */}
              <div className="flex items-center">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all ${
                  currentStep === 3 
                    ? 'bg-primary-500 border-primary-500 text-white'
                    : 'border-gray-600 text-gray-600'
                }`}>
                  3
                </div>
                <span className={`ml-2 text-sm font-medium ${
                  currentStep >= 3 ? 'text-white' : 'text-gray-600'
                }`}>
                  Test Visibility
                </span>
              </div>
            </div>
          </div>

          {/* Step 1: Brand Details Form */}
          {currentStep === 1 && (
          <div className="glass-effect rounded-2xl p-8 border border-white/10">
            <div className="space-y-6">
              {/* Brand Name */}
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  Brand Name
                </label>
                <input
                  type="text"
                  name="brandName"
                  value={formData.brandName}
                  onChange={handleInputChange}
                  placeholder="rocket"
                  className="w-full px-4 py-3 glass-light rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                />
              </div>

              {/* Website URL */}
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  Website URL
                </label>
                <input
                  type="url"
                  name="websiteUrl"
                  value={formData.websiteUrl}
                  onChange={handleInputChange}
                  placeholder="www.rocket.com"
                  className="w-full px-4 py-3 glass-light rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                />
                <p className="text-gray-500 text-xs mt-2">
                  Just drop your domain here, we'll fetch try all
                </p>
              </div>

              {/* Prompt/Search Scope */}
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  Prompt/Search Scope
                </label>
                <div className="flex space-x-4">
                  <button
                    onClick={() => setFormData(prev => ({ ...prev, searchScope: 'local' }))}
                    className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 rounded-xl transition-all ${
                      formData.searchScope === 'local'
                        ? 'bg-gradient-to-r from-primary-500 to-accent-500 text-white'
                        : 'glass-light text-gray-400 hover:text-white'
                    }`}
                  >
                    <Search className="w-5 h-5" />
                    <span className="font-medium">Local Search</span>
                  </button>
                  <button
                    onClick={() => setFormData(prev => ({ ...prev, searchScope: 'national' }))}
                    className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 rounded-xl transition-all ${
                      formData.searchScope === 'national'
                        ? 'bg-gradient-to-r from-primary-500 to-accent-500 text-white'
                        : 'glass-light text-gray-400 hover:text-white'
                    }`}
                  >
                    <Globe className="w-5 h-5" />
                    <span className="font-medium">National Search</span>
                  </button>
                </div>
                <p className="text-gray-500 text-xs mt-2">
                  {formData.searchScope === 'local' 
                    ? "Target customers in your city or region (e.g., 'Best dentist in Dallas')"
                    : 'Target customers nationwide. Use this marketing approach'}
                </p>
              </div>

              {/* Local Search - City Input */}
              {formData.searchScope === 'local' && (
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">
                    City & Country Code
                  </label>
                  <input
                    type="text"
                    name="localSearchCity"
                    value={formData.localSearchCity}
                    onChange={handleInputChange}
                    placeholder="e.g., Delhi, IN or New York, US"
                    className="w-full px-4 py-3 glass-light rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                  />
                </div>
              )}

              {/* National Search - Country Dropdown */}
              {formData.searchScope === 'national' && (
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">
                    Target Country
                  </label>
                  <select
                    name="targetCountry"
                    value={formData.targetCountry}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 glass-light rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all appearance-none cursor-pointer"
                  >
                    {countries.map((country) => (
                      <option key={country.code} value={country.code} className="bg-dark-800">
                        {country.name}, {country.code}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Language */}
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  Language
                </label>
                <select
                  name="language"
                  value={formData.language}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 glass-light rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all appearance-none cursor-pointer"
                >
                  {languages.map((lang) => (
                    <option key={lang} value={lang} className="bg-dark-800">
                      {lang}
                    </option>
                  ))}
                </select>
              </div>

              {/* AI Platforms */}
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-3">
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
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                        formData.platforms.perplexity
                          ? 'bg-primary-500 border-primary-500'
                          : 'border-gray-600 group-hover:border-gray-500'
                      }`}>
                        {formData.platforms.perplexity && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </div>
                    <span className="text-gray-300 group-hover:text-white transition-colors">
                      Perplexity
                    </span>
                  </label>

                  <label className="flex items-center space-x-3 cursor-pointer group">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={formData.platforms.chatgpt}
                        onChange={() => handlePlatformChange('chatgpt')}
                        className="sr-only"
                      />
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                        formData.platforms.chatgpt
                          ? 'bg-primary-500 border-primary-500'
                          : 'border-gray-600 group-hover:border-gray-500'
                      }`}>
                        {formData.platforms.chatgpt && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </div>
                    <span className="text-gray-300 group-hover:text-white transition-colors">
                      ChatGPT
                    </span>
                  </label>

                  <label className="flex items-center space-x-3 cursor-pointer group">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={formData.platforms.googleAiOverviews}
                        onChange={() => handlePlatformChange('googleAiOverviews')}
                        className="sr-only"
                      />
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                        formData.platforms.googleAiOverviews
                          ? 'bg-primary-500 border-primary-500'
                          : 'border-gray-600 group-hover:border-gray-500'
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
                        src="https://www.google.com/favicon.ico" 
                        alt="Google" 
                        className="w-4 h-4"
                      />
                      <span className="text-gray-300 group-hover:text-white transition-colors">
                        Google AI Overviews
                      </span>
                    </div>
                  </label>
                </div>
                
                <div className="mt-4 p-3 glass-light rounded-lg">
                  <p className="text-primary-400 text-xs">
                    <span className="font-semibold">💎 Google AI Overview</span>
                  </p>
                  <p className="text-gray-500 text-xs mt-1">
                    Use it to evaluate & optimize against Google AI Overviews or get ranked.
                  </p>
                </div>
              </div>

              {/* Favicon Preview */}
              {formData.brandFavicon && (
                <div className="flex items-center space-x-3 p-3 glass-light rounded-lg">
                  <img 
                    src={formData.brandFavicon} 
                    alt="Brand Favicon" 
                    className="w-8 h-8 rounded"
                  />
                  <span className="text-gray-300 text-sm">Brand favicon fetched successfully</span>
                </div>
              )}

              {/* Analyze Button */}
              <button
                onClick={handleAnalyzeBrand}
                disabled={isAnalyzing}
                className="w-full bg-gradient-to-r from-primary-500 to-accent-500 hover:from-primary-600 hover:to-accent-600 text-white font-bold py-4 px-6 rounded-xl transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2"
              >
                <Search className="w-5 h-5" />
                <span>{isAnalyzing ? 'Analyzing Brand...' : 'Analyze Brand'}</span>
              </button>
            </div>
          </div>
          )}

          {/* Step 2: Brand Analysis & Category Selection */}
          {currentStep === 2 && (
            <Step2BrandAnalysis
              brandData={formData}
              onComplete={handleStep2Complete}
              onBack={() => setCurrentStep(1)}
            />
          )}

          {/* Step 3: Ready to Analyze Visibility */}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="glass-effect border border-white/20 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-slide-up">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Existing Brand Found</h3>
              <button
                onClick={() => setShowBrandModal(false)}
                className="p-1 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400 hover:text-white" />
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
              
              <p className="text-gray-300 mb-2">
                We notice you already have a saved brand named{' '}
                <span className="text-white font-semibold">{existingBrand.name}</span>
              </p>
              
              <p className="text-gray-400 text-sm mb-1">
                Website: <span className="text-white">{existingBrand.website}</span>
              </p>
              
              <p className="text-gray-300 mt-4">
                Do you want to add this report to this brand?
              </p>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button
                onClick={() => {
                  // Handle adding report to existing brand
                  console.log('Adding report to brand:', existingBrand);
                  setShowBrandModal(false);
                  // You'll integrate with your n8n agent here
                }}
                className="w-full bg-gradient-to-r from-primary-500 to-accent-500 hover:from-primary-600 hover:to-accent-600 text-white font-bold py-3 px-6 rounded-xl transition-all flex items-center justify-center space-x-2"
              >
                <span>✅ Yes, add to this brand</span>
              </button>
              
              <button
                onClick={() => {
                  // Handle experimenting without saving
                  console.log('Just experimenting');
                  setShowBrandModal(false);
                  // Continue with analysis
                }}
                className="w-full glass-light hover:bg-white/10 text-gray-300 hover:text-white font-medium py-3 px-6 rounded-xl transition-all flex items-center justify-center space-x-2"
              >
                <span>🔬 No, just experimenting</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
