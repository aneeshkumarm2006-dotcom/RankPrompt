import { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, Plus, Check, Loader, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const Step2BrandAnalysis = ({ brandData, onComplete, onBack }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [brandSummary, setBrandSummary] = useState('');
  const [categories, setCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [customCategory, setCustomCategory] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [activeTab, setActiveTab] = useState('generate'); // 'generate' or 'custom'
  const [numberOfPrompts, setNumberOfPrompts] = useState(25);
  const [showMore, setShowMore] = useState(false);
  const [customPrompts, setCustomPrompts] = useState(['']);
  const [error, setError] = useState(null);
  
  // Prevent double API calls in React StrictMode
  const hasCalledAPI = useRef(false);

  // Prompt options based on subscription tier
  const isFreeTier = (user?.subscriptionTier || user?.currentPlan || 'free') === 'free';

  const promptOptions = isFreeTier
    ? [
        { value: 1, label: '1' },
        { value: 10, label: '10' },
        { value: 25, label: '25' },
        { value: 50, label: '50' },
      ]
    : [
        { value: 1, label: '1' },
        { value: 10, label: '10' },
        { value: 25, label: '25' },
        { value: 50, label: '50' },
        { value: 100, label: '100' },
        { value: 150, label: '150' },
      ];

  // Calculate max categories based on subscription tier
  // Free tier: 3 categories, Paid tiers: 10 categories
  const maxCategories = isFreeTier ? 3 : 10;
  
  // Debug log to check subscription tier
  useEffect(() => {
  }, [user?.subscriptionTier, maxCategories]);

  useEffect(() => {
    if (!hasCalledAPI.current) {
      hasCalledAPI.current = true;
      analyzeBrandAndGenerateCategories();
    }
  }, []);

  const analyzeBrandAndGenerateCategories = async () => {
    try {
      setLoading(true);
      setError(null);
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

      // Step 1: Analyze brand
      const analysisResponse = await fetch(`${API_URL}/openai/analyze-brand`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          brandName: brandData.brandName,
          websiteUrl: brandData.websiteUrl,
        }),
      });

      const analysisData = await analysisResponse.json();
      if (!analysisData.success) {
        throw new Error(analysisData.message || 'Failed to analyze brand');
      }

      setBrandSummary(analysisData.data.summary);

      // Step 2: Generate categories
      const categoriesResponse = await fetch(`${API_URL}/openai/generate-categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          brandName: brandData.brandName,
          websiteUrl: brandData.websiteUrl,
          summary: analysisData.data.summary,
        }),
      });

      const categoriesData = await categoriesResponse.json();
      if (!categoriesData.success) {
        throw new Error(categoriesData.message || 'Failed to generate categories');
      }

      setCategories(categoriesData.data.categories);
    } catch (err) {
      console.error('Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (category) => {
    setSelectedCategories((prev) => {
      const isSelected = prev.find((c) => c.name === category.name);
      if (isSelected) {
        return prev.filter((c) => c.name !== category.name);
      } else if (prev.length < maxCategories) {
        return [...prev, category];
      }
      return prev;
    });
  };

  const addCustomCategory = () => {
    if (customCategory.trim() && selectedCategories.length < maxCategories) {
      const newCategory = {
        name: customCategory.trim(),
        description: 'Custom category',
        custom: true,
      };
      setSelectedCategories([...selectedCategories, newCategory]);
      setCustomCategory('');
      setShowCustomInput(false);
    }
  };

  const handleAddCustomPrompt = () => {
    if (customPrompts.length < 25) {
      setCustomPrompts([...customPrompts, '']);
    }
  };

  const handleCustomPromptChange = (index, value) => {
    const updated = [...customPrompts];
    updated[index] = value;
    setCustomPrompts(updated);
  };

  const handleRemoveCustomPrompt = (index) => {
    if (customPrompts.length > 1) {
      setCustomPrompts(customPrompts.filter((_, i) => i !== index));
    }
  };

  const handleGeneratePrompts = () => {
    if (activeTab === 'generate') {
      if (selectedCategories.length === 0) {
        toast.error('Please select at least one category');
        return;
      }
      onComplete({
        summary: brandSummary,
        categories: selectedCategories,
        numberOfPrompts,
        mode: 'generate',
      });
    } else {
      const validPrompts = customPrompts.filter((p) => p.trim() !== '');
      if (validPrompts.length === 0) {
        toast.error('Please add at least one prompt');
        return;
      }
      onComplete({
        summary: brandSummary,
        customPrompts: validPrompts,
        mode: 'custom',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] bg-gray-50 dark:bg-dark-950">
        <Loader className="w-12 h-12 text-purple-600 animate-spin mb-4" />
        <p className="text-gray-800 dark:text-white text-lg">Analyzing your brand...</p>
        <p className="text-gray-600 dark:text-gray-400 text-sm mt-2">This may take a few moments</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400 mb-4">Error: {error}</p>
        <button
          onClick={analyzeBrandAndGenerateCategories}
          className="bg-[#4F46E5] text-white px-6 py-2 rounded-xl"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Brand Summary Card */}
      <div className="bg-white dark:bg-dark-900 rounded-xl sm:rounded-2xl border border-gray-200 dark:border-dark-700 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start space-y-3 sm:space-y-0 sm:space-x-4 mb-4">
          {brandData.brandFavicon && (
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <img
                src={brandData.brandFavicon}
                alt={brandData.brandName}
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg"
              />
            </div>
          )}
          <div className="flex-1 w-full">
            <div className="flex items-center justify-between mb-2 gap-2">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white break-words">{brandData.brandName}</h2>
              <a
                href={brandData.websiteUrl.startsWith('http') ? brandData.websiteUrl : `https://${brandData.websiteUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-600 hover:text-purple-700 dark:text-primary-400 dark:hover:text-primary-300 transition-colors"
              >
                <ExternalLink className="w-5 h-5" />
              </a>
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm mb-1 break-all">{brandData.websiteUrl}</p>
          </div>
        </div>

        <div>
          <p className="text-gray-800 dark:text-gray-200 text-xs sm:text-sm leading-relaxed">
            {showMore || brandSummary.length < 300
              ? brandSummary
              : `${brandSummary.substring(0, 300)}...`}
          </p>
          {brandSummary.length > 300 && (
            <button
              onClick={() => setShowMore(!showMore)}
              className="text-purple-600 hover:text-purple-700 dark:text-primary-400 dark:hover:text-primary-300 text-sm mt-2 flex items-center space-x-1"
            >
              <span>{showMore ? 'Show Less' : 'Show More'}</span>
              {showMore ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Initial Analysis Complete Section */}
      <div className="bg-white dark:bg-dark-900 rounded-xl sm:rounded-2xl border border-green-200 dark:border-green-500/30 p-4 sm:p-6">
        <h3 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white mb-2">Initial Analysis Complete</h3>
        <p className="text-gray-800 dark:text-gray-200 text-xs sm:text-sm mb-4">
          We've analyzed your brand's visibility. Select business categories and how many prompts you'd like to generate for a detailed analysis.
        </p>

        {/* Tabs */}
        <div className="flex flex-col sm:flex-row space-y-0 sm:space-x-2 mb-4 sm:mb-6 border-b border-gray-200 dark:border-dark-700">
          <button
            onClick={() => setActiveTab('generate')}
            className={`pb-2 sm:pb-3 px-3 sm:px-4 text-sm sm:text-base font-medium transition-colors relative ${
              activeTab === 'generate'
                ? 'text-purple-600 dark:text-primary-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white'
            }`}
          >
            Generate Prompts by Category
            {activeTab === 'generate' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600"></div>
            )}
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={`pb-2 sm:pb-3 px-3 sm:px-4 text-sm sm:text-base font-medium transition-colors relative ${
              activeTab === 'custom'
                ? 'text-purple-600 dark:text-primary-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white'
            }`}
          >
            Write Your Own Prompts
            {activeTab === 'custom' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600"></div>
            )}
          </button>
        </div>

        {/* Generate by Category Tab */}
        {activeTab === 'generate' && (
          <div>
            <div className="mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                <label className="text-gray-800 dark:text-white text-sm sm:text-base font-medium">
                  Select Business Categories (up to {maxCategories})
                </label>
                <span className="text-purple-600 dark:text-primary-400 text-xs sm:text-sm font-semibold">
                  {selectedCategories.length}/{maxCategories} selected
                </span>
              </div>

              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                {categories.map((category, index) => {
                  const isSelected = selectedCategories.find((c) => c.name === category.name);
                  return (
                    <div
                      key={index}
                      onClick={() => toggleCategory(category)}
                      className={`p-4 rounded-xl cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-purple-100 dark:bg-purple-500/10 border-2 border-purple-600 dark:border-primary-500'
                          : 'bg-gray-100 dark:bg-dark-800 hover:bg-gray-200 dark:hover:bg-dark-700 border-2 border-transparent'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="text-gray-800 dark:text-white font-medium">{category.name}</span>
                            {isSelected && <Check className="w-4 h-4 text-purple-600" />}
                          </div>
                          <p className="text-gray-600 dark:text-gray-400 text-sm">{category.description}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add Custom Category */}
              {!showCustomInput && selectedCategories.length < maxCategories && (
                <button
                  onClick={() => setShowCustomInput(true)}
                  className="mt-3 text-purple-600 hover:text-purple-700 dark:text-primary-400 dark:hover:text-primary-300 text-sm flex items-center space-x-1"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Custom Category</span>
                </button>
              )}

              {showCustomInput && (
                <div className="mt-3 flex space-x-2">
                  <input
                    type="text"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder="Enter custom category name"
                    className="flex-1 px-4 py-2 bg-white dark:bg-dark-700 rounded-xl border border-gray-300 dark:border-dark-600 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-gray-800 dark:text-gray-200 placeholder-gray-500 transition-all"
                    onKeyPress={(e) => e.key === 'Enter' && addCustomCategory()}
                  />
                  <button
                    onClick={addCustomCategory}
                    className="bg-primary-500 text-white px-4 py-2 rounded-xl transition-colors"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => {
                      setShowCustomInput(false);
                      setCustomCategory('');
                    }}
                    className="bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 text-gray-800 dark:text-gray-200 px-4 py-2 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {/* Number of Prompts */}
            <div>
              <label className="block text-gray-800 dark:text-white font-medium mb-3">
                Number of Prompts to Generate
              </label>
              <div className="flex flex-wrap gap-3">
                {promptOptions.map((option) => (
                  <button
                    key={`${option.value}-${option.disabled ? 'disabled' : 'enabled'}`}
                    onClick={() => !option.disabled && setNumberOfPrompts(option.value)}
                    disabled={option.disabled}
                    className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                      numberOfPrompts === option.value && !option.disabled
                        ? 'bg-primary-500 text-white'
                        : option.disabled
                        ? 'bg-gray-100 dark:bg-dark-800 text-gray-400 dark:text-gray-500 cursor-not-allowed opacity-50'
                        : 'bg-gray-100 dark:bg-dark-800 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-dark-700 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    {option.label}
                    {option.pro && (
                      <span className="ml-2 text-xs bg-purple-100 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded">
                        PRO
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Write Your Own Prompts Tab */}
        {activeTab === 'custom' && (
          <div>
            <div className="mb-4">
              <h4 className="text-lg font-bold text-gray-800 dark:text-white mb-2">Write Your Own Prompts</h4>
              <p className="text-gray-800 dark:text-gray-200 text-sm mb-4">
                Add up to 25 prompts. You can optionally add a category for each prompt.
              </p>

              <button
                onClick={handleAddCustomPrompt}
                disabled={customPrompts.length >= 25}
                className="mb-4 text-purple-600 hover:text-purple-700 dark:text-primary-400 dark:hover:text-primary-300 text-sm flex items-center space-x-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                <span>Add Prompt</span>
              </button>
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {customPrompts.map((prompt, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={prompt}
                    onChange={(e) => handleCustomPromptChange(index, e.target.value)}
                    placeholder={`Prompt #${index + 1}`}
                    className="flex-1 px-4 py-3 bg-white dark:bg-dark-800 rounded-xl border border-gray-300 dark:border-dark-600 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-gray-800 dark:text-gray-200 placeholder-gray-500 transition-all"
                  />
                  {customPrompts.length > 1 && (
                    <button
                      onClick={() => handleRemoveCustomPrompt(index)}
                      className="p-3 bg-gray-100 dark:bg-dark-700 hover:bg-red-100 dark:hover:bg-red-500/20 hover:text-red-600 dark:hover:text-red-400 rounded-xl transition-colors"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>

            <p className="text-gray-600 dark:text-gray-400 text-sm mt-4">
              {customPrompts.filter((p) => p.trim()).length} / 25 prompts
            </p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="bg-gray-100 dark:bg-dark-800 hover:bg-gray-200 dark:hover:bg-dark-700 text-gray-800 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white font-medium py-3 px-8 rounded-xl transition-all"
        >
          ← Back
        </button>
        <button
          onClick={handleGeneratePrompts}
          className="bg-primary-500 text-white font-bold py-3 px-8 rounded-xl transition-all flex items-center space-x-2"
        >
          <span>
            {activeTab === 'generate'
              ? `Generate ${numberOfPrompts} Prompts`
              : 'Continue'}
          </span>
          <span>→</span>
        </button>
      </div>
    </div>
  );
};

export default Step2BrandAnalysis;
