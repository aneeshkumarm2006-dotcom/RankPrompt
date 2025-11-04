import { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, Plus, Check, Loader, ExternalLink } from 'lucide-react';
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
  const promptOptions = user?.subscriptionTier === 'free' 
    ? [
        { value: 1, label: '1' },
        { value: 10, label: '10' },
        { value: 25, label: '25' },
        { value: 50, label: '50' },
        { value: 100, label: '100', disabled: true, pro: true },
        { value: 150, label: '150', disabled: true, pro: true },
      ]
    : [
        { value: 1, label: '1' },
        { value: 10, label: '10' },
        { value: 25, label: '25' },
        { value: 50, label: '50' },
        { value: 100, label: '100' },
        { value: 150, label: '150' },
      ];

  const maxCategories = user?.subscriptionTier === 'free' ? 3 : 10;

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
        alert('Please select at least one category');
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
        alert('Please add at least one prompt');
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
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader className="w-12 h-12 text-primary-500 animate-spin mb-4" />
        <p className="text-gray-300 text-lg">Analyzing your brand...</p>
        <p className="text-gray-500 text-sm mt-2">This may take a few moments</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400 mb-4">Error: {error}</p>
        <button
          onClick={analyzeBrandAndGenerateCategories}
          className="bg-gradient-to-r from-primary-500 to-accent-500 text-white px-6 py-2 rounded-xl"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Brand Summary Card */}
      <div className="glass-effect rounded-2xl border border-white/10 p-6">
        <div className="flex items-start space-x-4 mb-4">
          {brandData.brandFavicon && (
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <img
                src={brandData.brandFavicon}
                alt={brandData.brandName}
                className="w-12 h-12 rounded-lg"
              />
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-2xl font-bold text-white">{brandData.brandName}</h2>
              <a
                href={brandData.websiteUrl.startsWith('http') ? brandData.websiteUrl : `https://${brandData.websiteUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-400 hover:text-primary-300 transition-colors"
              >
                <ExternalLink className="w-5 h-5" />
              </a>
            </div>
            <p className="text-gray-400 text-sm mb-1">{brandData.websiteUrl}</p>
          </div>
        </div>

        <div>
          <p className="text-gray-300 text-sm leading-relaxed">
            {showMore || brandSummary.length < 300
              ? brandSummary
              : `${brandSummary.substring(0, 300)}...`}
          </p>
          {brandSummary.length > 300 && (
            <button
              onClick={() => setShowMore(!showMore)}
              className="text-primary-400 hover:text-primary-300 text-sm mt-2 flex items-center space-x-1"
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
      <div className="glass-effect rounded-2xl border border-green-500/30 p-6">
        <h3 className="text-xl font-bold text-white mb-2">Initial Analysis Complete</h3>
        <p className="text-gray-300 text-sm mb-4">
          We've analyzed your brand's visibility. Select business categories and how many prompts you'd like to generate for a detailed analysis.
        </p>

        {/* Tabs */}
        <div className="flex space-x-2 mb-6 border-b border-white/10">
          <button
            onClick={() => setActiveTab('generate')}
            className={`pb-3 px-4 font-medium transition-colors relative ${
              activeTab === 'generate'
                ? 'text-primary-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Generate Prompts by Category
            {activeTab === 'generate' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-400"></div>
            )}
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={`pb-3 px-4 font-medium transition-colors relative ${
              activeTab === 'custom'
                ? 'text-primary-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Write Your Own Prompts
            {activeTab === 'custom' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-400"></div>
            )}
          </button>
        </div>

        {/* Generate by Category Tab */}
        {activeTab === 'generate' && (
          <div>
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <label className="text-gray-300 font-medium">
                  Select Business Categories (up to {maxCategories})
                </label>
                <span className="text-primary-400 text-sm font-semibold">
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
                          ? 'bg-purple-500/20 border-2 border-purple-500'
                          : 'glass-light hover:bg-white/10 border-2 border-transparent'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="text-white font-medium">{category.name}</span>
                            {isSelected && <Check className="w-4 h-4 text-purple-400" />}
                          </div>
                          <p className="text-gray-400 text-sm">{category.description}</p>
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
                  className="mt-3 text-primary-400 hover:text-primary-300 text-sm flex items-center space-x-1"
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
                    className="flex-1 px-4 py-2 glass-light rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    onKeyPress={(e) => e.key === 'Enter' && addCustomCategory()}
                  />
                  <button
                    onClick={addCustomCategory}
                    className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-xl transition-colors"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => {
                      setShowCustomInput(false);
                      setCustomCategory('');
                    }}
                    className="glass-light hover:bg-white/10 text-gray-300 px-4 py-2 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {/* Number of Prompts */}
            <div>
              <label className="block text-gray-300 font-medium mb-3">
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
                        ? 'bg-gradient-to-r from-primary-500 to-accent-500 text-white'
                        : option.disabled
                        ? 'glass-light text-gray-500 cursor-not-allowed opacity-50'
                        : 'glass-light text-gray-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {option.label}
                    {option.pro && (
                      <span className="ml-2 text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded">
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
              <h4 className="text-lg font-bold text-white mb-2">Write Your Own Prompts</h4>
              <p className="text-gray-300 text-sm mb-4">
                Add up to 25 prompts. You can optionally add a category for each prompt.
              </p>

              <button
                onClick={handleAddCustomPrompt}
                disabled={customPrompts.length >= 25}
                className="mb-4 text-primary-400 hover:text-primary-300 text-sm flex items-center space-x-1 disabled:opacity-50 disabled:cursor-not-allowed"
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
                    className="flex-1 px-4 py-3 glass-light rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  {customPrompts.length > 1 && (
                    <button
                      onClick={() => handleRemoveCustomPrompt(index)}
                      className="p-3 glass-light hover:bg-red-500/20 hover:text-red-400 rounded-xl transition-colors"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>

            <p className="text-gray-500 text-sm mt-4">
              {customPrompts.filter((p) => p.trim()).length} / 25 prompts
            </p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="glass-light hover:bg-white/10 text-gray-300 hover:text-white font-medium py-3 px-8 rounded-xl transition-all"
        >
          ← Back
        </button>
        <button
          onClick={handleGeneratePrompts}
          className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-3 px-8 rounded-xl transition-all flex items-center space-x-2"
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
