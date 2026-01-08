import { useState, useEffect, useRef } from 'react';
import { Search, Edit2, ExternalLink, Loader, ChevronDown } from 'lucide-react';
import { getAuthHeaders } from '../services/api';

const Step3ReadyToAnalyze = ({ brandData, step2Data, onAnalyze, onBack, onStartOver }) => {
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllPrompts, setShowAllPrompts] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editedText, setEditedText] = useState('');

  // Prevent double API calls in React StrictMode
  const hasCalledAPI = useRef(false);

  useEffect(() => {
    if (!hasCalledAPI.current) {
      hasCalledAPI.current = true;
      if (step2Data.mode === 'generate') {
        generatePromptsWithAI();
      } else {
        // Custom prompts mode
        setPrompts(
          step2Data.customPrompts.map((text, index) => ({
            text,
            category: 'Custom',
            categoryDescription: 'User-defined prompt',
          }))
        );
      }
    }
  }, []);

  const generatePromptsWithAI = async () => {
    try {
      setLoading(true);
      setError(null);
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

      const response = await fetch(`${API_URL}/openai/generate-prompts`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          brandName: brandData.brandName,
          websiteUrl: brandData.websiteUrl,
          categories: step2Data.categories,
          numberOfPrompts: step2Data.numberOfPrompts,
          searchScope: brandData.searchScope,
          location:
            brandData.searchScope === 'local'
              ? brandData.localSearchCity
              : brandData.targetCountry,
          language: brandData.language,
        }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'Failed to generate prompts');
      }

      setPrompts(data.data.prompts);
    } catch (err) {
      console.error('Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getUniqueCategories = () => {
    const categories = new Set(prompts.map((p) => p.category));
    return ['All Categories', ...Array.from(categories)];
  };

  const getFilteredPrompts = () => {
    let filtered = prompts;

    if (selectedCategory !== 'All Categories') {
      filtered = filtered.filter((p) => p.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      filtered = filtered.filter((p) =>
        p.text.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filtered;
  };

  const filteredPrompts = getFilteredPrompts();
  const displayedPrompts = showAllPrompts ? filteredPrompts : filteredPrompts.slice(0, 5);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] bg-gray-50 dark:bg-dark-950">
        <Loader className="w-12 h-12 text-purple-600 animate-spin mb-4" />
        <p className="text-gray-800 dark:text-white text-lg">Generating prompts...</p>
        <p className="text-gray-600 dark:text-gray-400 text-sm mt-2">This may take a few moments</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 dark:text-gray-400 text-sm">{error}</p>
        <button
          onClick={generatePromptsWithAI}
          className="bg-primary-500 text-white px-4 py-2 rounded-xl transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Brand Summary Card */}
      <div className="bg-white dark:bg-dark-700 rounded-xl sm:rounded-2xl border border-gray-200 dark:border-dark-700 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start space-y-3 sm:space-y-0 sm:space-x-4">
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
                href={
                  brandData.websiteUrl.startsWith('http')
                    ? brandData.websiteUrl
                    : `https://${brandData.websiteUrl}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-600 dark:text-primary-400 hover:text-purple-700 dark:hover:text-primary-300 transition-colors"
              >
                <ExternalLink className="w-5 h-5" />
              </a>
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm break-all">{brandData.websiteUrl}</p>
          </div>
        </div>

        {step2Data.summary && (
          <p className="text-gray-800 dark:text-gray-200 text-xs sm:text-sm leading-relaxed">
            {step2Data.summary.substring(0, 200)}...
          </p>
        )}
      </div>

      {/* Ready to Analyze Section */}
      <div className="bg-white dark:bg-dark-700 rounded-xl sm:rounded-2xl border border-gray-200 dark:border-dark-700 p-4 sm:p-6">
        <h3 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white mb-2">Initial Analysis Complete</h3>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row space-y-0 sm:space-x-2 mb-4 sm:mb-6 border-b border-gray-200 dark:border-dark-700">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500 dark:text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search prompts..."
              className="w-full pl-12 pr-4 py-3 bg-white dark:bg-dark-800 rounded-xl border border-gray-300 dark:border-dark-600 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-500"
            />
          </div>
          <div className="relative">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="flex-1 px-4 py-2 bg-white dark:bg-dark-800 rounded-xl border border-gray-300 dark:border-dark-600 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-gray-800 dark:text-gray-200 placeholder-gray-500 transition-all"
            >
              {getUniqueCategories().map((category) => (
                <option key={category} value={category} className="bg-white dark:bg-dark-800">
                  {category}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500 dark:text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Category Pills */}
        {step2Data.mode === 'generate' && (
          <div className="flex flex-wrap gap-2 mb-4 sm:mb-6">
            <button
              onClick={() => setSelectedCategory('All Categories')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${selectedCategory === 'All Categories'
                  ? 'bg-gray-800 dark:bg-dark-700 text-white'
                  : 'bg-gray-100 dark:bg-dark-800 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-dark-700'
                }`}
            >
              All
            </button>
            {step2Data.categories.map((cat, index) => (
              <button
                key={index}
                onClick={() => setSelectedCategory(cat.name)}
                className={`pb-2 sm:pb-3 px-3 sm:px-4 text-sm sm:text-base font-medium transition-colors relative ${selectedCategory === cat.name
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 dark:bg-dark-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-dark-700'
                  }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}

        {/* Prompts List */}
        <div className="space-y-3 mb-4 sm:mb-6">
          {displayedPrompts.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No prompts found matching your search
            </div>
          ) : (
            displayedPrompts.map((prompt, displayIndex) => {
              const actualIndex = prompts.findIndex(p => p === prompt);
              return (
                <div
                  key={actualIndex}
                  className="bg-gray-50 dark:bg-dark-800 rounded-xl p-3 sm:p-4 hover:bg-gray-100 dark:hover:bg-dark-700 transition-all group"
                >
                  <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
                    <div className="flex-1">
                      {editingIndex === actualIndex ? (
                        <input
                          type="text"
                          value={editedText}
                          onChange={(e) => setEditedText(e.target.value)}
                          className="w-full px-3 py-2 bg-white dark:bg-dark-700 rounded-lg border border-gray-300 dark:border-dark-600 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 mb-2 dark:focus:ring-primary-500"
                          autoFocus
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              const updatedPrompts = [...prompts];
                              updatedPrompts[actualIndex].text = editedText;
                              setPrompts(updatedPrompts);
                              setEditingIndex(null);
                              setEditedText('');
                            }
                          }}
                        />
                      ) : (
                        <p className="text-gray-800 dark:text-gray-200 mb-2 group-hover:text-purple-700 dark:group-hover:text-primary-400 transition-colors">
                          {prompt.text}
                        </p>
                      )}
                      <div className="flex items-center space-x-2">
                        <span className="inline-block px-2 sm:px-3 py-0.5 sm:py-1 bg-purple-100 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-full text-xs font-medium">
                          {prompt.category}
                        </span>
                      </div>
                    </div>
                    {editingIndex === actualIndex ? (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => {
                            const updatedPrompts = [...prompts];
                            updatedPrompts[actualIndex].text = editedText;
                            setPrompts(updatedPrompts);
                            setEditingIndex(null);
                            setEditedText('');
                          }}
                          className="p-3 bg-gray-100 dark:bg-dark-800 hover:bg-red-100 dark:hover:bg-red-500/20 hover:text-red-600 dark:hover:text-red-400 rounded-xl transition-colors"
                          title="Save"
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => {
                            setEditingIndex(null);
                            setEditedText('');
                          }}
                          className="p-3 bg-gray-100 dark:bg-dark-800 hover:bg-red-100 dark:hover:bg-red-500/20 hover:text-red-600 dark:hover:text-red-400 rounded-xl transition-colors"
                          title="Cancel"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingIndex(actualIndex);
                          setEditedText(prompt.text);
                        }}
                        className="p-2 bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 rounded-lg transition-colors text-white"
                        title="Edit prompt"
                      >
                        <Edit2 className="w-4 h-4 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* View All / Collapse Button */}
        {filteredPrompts.length > 5 && (
          <div className="text-center mb-6">
            <button
              onClick={() => setShowAllPrompts(!showAllPrompts)}
              className="text-purple-600 dark:text-primary-400 hover:text-purple-700 dark:hover:text-primary-300 text-sm mt-2 flex items-center space-x-1"
            >
              {showAllPrompts
                ? 'Show Less'
                : `View All (${filteredPrompts.length} Prompts) →`}
            </button>
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center justify-between p-4 bg-gray-100 dark:bg-dark-800 rounded-xl mb-6">
          <span className="text-gray-800 dark:text-white font-medium">{filteredPrompts.length} prompts ready</span>
          <span className="text-purple-600 hover:text-purple-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium transition-colors text-sm">
            {prompts.length} total
          </span>
        </div>

        {/* Analyze Button */}
        <button
          onClick={() => onAnalyze(prompts)}
          className="w-full bg-primary-500 text-white font-bold py-4 px-6 rounded-xl transition-all flex items-center justify-center space-x-2"
        >
          <span>Analyze Visibility</span>
          <span>→</span>
        </button>
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
          onClick={onStartOver}
          className="bg-gray-100 dark:bg-dark-800 hover:bg-gray-200 dark:hover:bg-dark-700 text-gray-800 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white font-medium py-3 px-8 rounded-xl transition-all"
        >
          Start Over
        </button>
      </div>
    </div>
  );
};

export default Step3ReadyToAnalyze;
