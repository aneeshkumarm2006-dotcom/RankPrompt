import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Filter, Eye } from 'lucide-react';
import { getAuthHeaders } from '../services/api';
import toast from 'react-hot-toast';

const AllPrompts = () => {
  const { brandId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [selectedPlatform, setSelectedPlatform] = useState('All Platforms');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [staticReport, setStaticReport] = useState(null);
  const [scheduledReports, setScheduledReports] = useState([]);
  const [aiAnswerContent, setAiAnswerContent] = useState(null);
  const [brandData, setBrandData] = useState(null);

  useEffect(() => {
    fetchData();
  }, [brandId]);

  const fetchData = async () => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    try {
      setLoading(true);

      // Fetch brand data
      const brandRes = await fetch(`${API_URL}/brand/${brandId}`, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (brandRes.ok) {
        const { data } = await brandRes.json();
        setBrandData(data);
      }

      // Fetch all reports for the brand
      const reportsRes = await fetch(`${API_URL}/reports/brand/${brandId}`, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      if (reportsRes.ok) {
        const { data: reports } = await reportsRes.json();

        if (reports && reports.length > 0) {
          // The oldest report is the static/first report (last in descending order)
          const sortedReports = [...reports].sort((a, b) =>
            new Date(a.createdAt) - new Date(b.createdAt)
          );
          setStaticReport(sortedReports[0]);

          // All others are scheduled reports
          if (sortedReports.length > 1) {
            setScheduledReports(sortedReports.slice(1));
          }
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load prompts');
    } finally {
      setLoading(false);
    }
  };

  const getAllPrompts = () => {
    let allPrompts = [];

    if (staticReport && staticReport.reportData) {
      staticReport.reportData.forEach((item, index) => {
        allPrompts.push({
          prompt: item.prompt,
          category: item.category,
          reportType: 'Static',
          reportDate: staticReport.reportDate || staticReport.createdAt,
          responses: item.response || [],
          index: index + 1
        });
      });
    }

    scheduledReports.forEach(report => {
      if (report.reportData) {
        report.reportData.forEach((item, index) => {
          allPrompts.push({
            prompt: item.prompt,
            category: item.category,
            reportType: 'Scheduled',
            reportDate: report.reportDate || report.createdAt,
            responses: item.response || [],
            index: index + 1
          });
        });
      }
    });

    return allPrompts;
  };

  const getScheduledPrompts = () => {
    let prompts = [];
    scheduledReports.forEach(report => {
      if (report.reportData) {
        report.reportData.forEach((item, index) => {
          prompts.push({
            prompt: item.prompt,
            category: item.category,
            reportType: 'Scheduled',
            reportDate: report.reportDate || report.createdAt,
            responses: item.response || [],
            index: index + 1
          });
        });
      }
    });
    return prompts;
  };

  const getStaticPrompts = () => {
    let prompts = [];
    if (staticReport && staticReport.reportData) {
      staticReport.reportData.forEach((item, index) => {
        prompts.push({
          prompt: item.prompt,
          category: item.category,
          reportType: 'Static',
          reportDate: staticReport.reportDate || staticReport.createdAt,
          responses: item.response || [],
          index: index + 1
        });
      });
    }
    return prompts;
  };

  const getCurrentPrompts = () => {
    switch (activeTab) {
      case 'scheduled':
        return getScheduledPrompts();
      case 'static':
        return getStaticPrompts();
      default:
        return getAllPrompts();
    }
  };

  const prompts = getCurrentPrompts();

  // Get unique categories and AI platforms from responses
  const categories = ['All Categories', ...new Set(prompts.map(p => p.category))];
  const allAiPlatforms = new Set();
  prompts.forEach(p => {
    p.responses?.forEach(r => allAiPlatforms.add(r.src));
  });
  const platforms = ['All Platforms', ...Array.from(allAiPlatforms)];

  // Filter prompts
  const filteredPrompts = prompts.filter(p => {
    const matchesSearch = !searchQuery ||
      p.prompt.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All Categories' ||
      p.category === selectedCategory;
    const matchesPlatform = selectedPlatform === 'All Platforms' ||
      p.responses?.some(r => r.src === selectedPlatform);
    const matchesStatus = selectedStatus === 'All' ||
      (selectedStatus === 'Ranked' && p.responses?.some(r => r.found)) ||
      (selectedStatus === 'Not Ranked' && p.responses?.every(r => !r.found));

    return matchesSearch && matchesCategory && matchesPlatform && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 bg-gray-50 dark:bg-dark-950 min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-gray-400 dark:text-gray-500">Loading prompts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-[#F8FAFC] dark:bg-dark-950">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white">All Prompts</h1>
          {brandData && (
            <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm sm:text-base">{brandData.brandName}</p>
          )}
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-dark-900 rounded-lg border border-gray-200 dark:border-dark-700 mb-6">
          <div className="border-b border-gray-200 dark:border-dark-700 px-4 sm:px-6 py-4">
            <div className="flex items-center gap-4 sm:gap-6 overflow-x-auto">
              <button
                onClick={() => setActiveTab('all')}
                className={`${activeTab === 'all'
                    ? 'text-primary-500 dark:text-primary-400 border-b-2 border-primary-500 dark:border-primary-400'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white'
                  } font-semibold pb-2 transition-colors whitespace-nowrap text-sm sm:text-base`}
              >
                All Prompts ({getAllPrompts().length})
              </button>
              <button
                onClick={() => setActiveTab('scheduled')}
                className={`${activeTab === 'scheduled'
                    ? 'text-primary-500 dark:text-primary-400 border-b-2 border-primary-500 dark:border-primary-400'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white'
                  } font-semibold pb-2 transition-colors whitespace-nowrap text-sm sm:text-base`}
              >
                Scheduled Prompt Results ({getScheduledPrompts().length})
              </button>
              <button
                onClick={() => setActiveTab('static')}
                className={`${activeTab === 'static'
                    ? 'text-primary-500 dark:text-primary-400 border-b-2 border-primary-500 dark:border-primary-400'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white'
                  } font-semibold pb-2 transition-colors whitespace-nowrap text-sm sm:text-base`}
              >
                Static Prompt Results ({getStaticPrompts().length})
              </button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-dark-900 rounded-lg p-4 sm:p-6 mb-6 border border-gray-200 dark:border-dark-700">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Status Filter */}
            <div className="relative">
              <label className="block text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                <Filter className="w-4 h-4 inline mr-1" />
                Status
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full bg-white dark:bg-dark-800 text-gray-800 dark:text-gray-200 rounded-lg px-3 sm:px-4 py-2 border border-gray-300 dark:border-dark-600 focus:border-primary-500 focus:outline-none text-sm sm:text-base"
              >
                <option>All</option>
                <option>Ranked</option>
                <option>Not Ranked</option>
              </select>
            </div>

            {/* Category Filter */}
            <div className="relative">
              <label className="block text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full bg-white dark:bg-dark-800 text-gray-800 dark:text-gray-200 rounded-lg px-3 sm:px-4 py-2 border border-gray-300 dark:border-dark-600 focus:border-primary-500 focus:outline-none text-sm sm:text-base"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Platform Filter */}
            <div className="relative">
              <label className="block text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Platform</label>
              <select
                value={selectedPlatform}
                onChange={(e) => setSelectedPlatform(e.target.value)}
                className="w-full bg-white dark:bg-dark-800 text-gray-800 dark:text-gray-200 rounded-lg px-3 sm:px-4 py-2 border border-gray-300 dark:border-dark-600 focus:border-primary-500 focus:outline-none text-sm sm:text-base"
              >
                {platforms.map(plat => (
                  <option key={plat} value={plat}>{plat}</option>
                ))}
              </select>
            </div>

            {/* Search */}
            <div className="relative">
              <label className="block text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search prompts..."
                  className="w-full bg-white dark:bg-dark-800 text-gray-800 dark:text-gray-200 rounded-lg pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 border border-gray-300 dark:border-dark-600 focus:border-primary-500 focus:outline-none text-sm sm:text-base"
                />
              </div>
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
            Showing {filteredPrompts.length} of {prompts.length} prompts
          </div>
        </div>

        {/* Results - Desktop Table / Mobile Cards */}
        <div className="bg-white dark:bg-dark-900 rounded-lg border border-gray-200 dark:border-dark-700">
          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-dark-800">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    AI Models
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Prompt Text
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Rank
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Mentions
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
                {filteredPrompts.length > 0 ? (
                  filteredPrompts.map((prompt, idx) => {
                    const foundCount = prompt.responses?.filter(r => r.found).length || 0;
                    const totalResponses = prompt.responses?.length || 0;
                    const aiModels = [...new Set(prompt.responses?.map(r => r.src) || [])];

                    return (
                      <tr key={idx} className="hover:bg-gray-100 dark:hover:bg-dark-800 transition-colors">
                        <td className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {new Date(prompt.reportDate).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex gap-1 flex-wrap">
                            {aiModels.map((model, midx) => (
                              <span key={midx} className="px-2 py-1 bg-gray-200 dark:bg-dark-700 text-gray-700 dark:text-gray-300 rounded text-xs capitalize">
                                {model === 'chatgpt' ? 'GPT' : model === 'perplexity' ? 'PPX' : model === 'google_ai_overviews' ? 'AIO' : model}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-sm">
                          <span className={`px-2 py-1 rounded text-xs ${prompt.reportType === 'Scheduled'
                              ? 'bg-blue-500/20 text-blue-400'
                              : 'bg-purple-500/20 text-purple-400'
                            }`}>
                            {prompt.reportType}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-800 dark:text-gray-200 max-w-md truncate">
                          {prompt.prompt}
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400">
                          <span className="px-2 py-1 bg-gray-200 dark:bg-dark-700 text-gray-700 dark:text-gray-300 rounded-full text-xs">
                            {prompt.category}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-800 dark:text-gray-200 whitespace-nowrap">
                          #{prompt.index}
                        </td>
                        <td className="px-3 py-3 text-sm whitespace-nowrap">
                          {foundCount > 0 ? (
                            <span className="inline-flex items-center px-2 py-1 bg-green-500 bg-opacity-20 text-green-400 rounded-full text-xs font-medium">
                              ✓ {foundCount}/{totalResponses}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 bg-red-500 bg-opacity-20 text-red-400 rounded-full text-xs font-medium">
                              ✗ 0/{totalResponses}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-sm whitespace-nowrap">
                          {prompt.responses && prompt.responses.length > 0 && (
                            <button
                              onClick={() => {
                                const firstResp = prompt.responses[0];
                                setAiAnswerContent({
                                  platform: firstResp.src === 'google_ai_overviews' ? 'Google AI' : firstResp.src,
                                  prompt: prompt.prompt,
                                  answer: firstResp.aianswer || 'No AI answer available'
                                });
                              }}
                              className="text-primary-400 hover:text-primary-300 dark:text-primary-500 dark:hover:text-primary-400 flex items-center gap-1"
                            >
                              <Eye className="w-4 h-4" /> View
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="8" className="px-3 py-8 text-center text-gray-500 dark:text-gray-400">
                      No prompts found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="lg:hidden">
            {filteredPrompts.length > 0 ? (
              <div className="divide-y divide-gray-200 dark:divide-dark-700">
                {filteredPrompts.map((prompt, idx) => {
                  const foundCount = prompt.responses?.filter(r => r.found).length || 0;
                  const totalResponses = prompt.responses?.length || 0;
                  const aiModels = [...new Set(prompt.responses?.map(r => r.src) || [])];

                  return (
                    <div key={idx} className="p-4 hover:bg-gray-100 dark:hover:bg-dark-800 transition-colors">
                      {/* Date & Status */}
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(prompt.reportDate).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric'
                          })}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs ${prompt.reportType === 'Scheduled'
                            ? 'bg-blue-500/20 text-blue-400'
                            : 'bg-purple-500/20 text-purple-400'
                          }`}>
                          {prompt.reportType}
                        </span>
                      </div>

                      {/* Prompt Text */}
                      <p className="text-sm text-gray-800 dark:text-gray-200 font-medium mb-2 line-clamp-2">{prompt.prompt}</p>

                      {/* Category & AI Models */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        <span className="px-2 py-1 bg-gray-200 dark:bg-dark-700 rounded-full text-xs text-gray-700 dark:text-gray-300">
                          {prompt.category}
                        </span>
                        {aiModels.map((model, midx) => (
                          <span key={midx} className="px-2 py-1 bg-gray-200 dark:bg-dark-700 text-gray-700 dark:text-gray-300 rounded text-xs capitalize">
                            {model === 'chatgpt' ? 'GPT' : model === 'perplexity' ? 'PPX' : model === 'google_ai_overviews' ? 'AIO' : model}
                          </span>
                        ))}
                      </div>

                      {/* Mentions & Action */}
                      <div className="flex items-center justify-between">
                        {foundCount > 0 ? (
                          <span className="inline-flex items-center px-2 py-1 bg-green-500 bg-opacity-20 text-green-400 rounded-full text-xs font-medium">
                            ✓ {foundCount}/{totalResponses} Mentions
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 bg-red-500 bg-opacity-20 text-red-400 rounded-full text-xs font-medium">
                            ✗ Not Found
                          </span>
                        )}
                        {prompt.responses && prompt.responses.length > 0 && (
                          <button
                            onClick={() => {
                              const firstResp = prompt.responses[0];
                              setAiAnswerContent({
                                platform: firstResp.src === 'google_ai_overviews' ? 'Google AI' : firstResp.src,
                                prompt: prompt.prompt,
                                answer: firstResp.aianswer || 'No AI answer available'
                              });
                            }}
                            className="text-primary-400 hover:text-primary-300 dark:text-primary-500 dark:hover:text-primary-400 flex items-center gap-1 text-xs"
                          >
                            <Eye className="w-3 h-3" /> View
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                No prompts found
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Answer Modal */}
      {aiAnswerContent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-lg p-4 sm:p-6 w-full max-w-4xl max-h-[85vh] overflow-y-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-3 mb-4">
              <div className="flex-1 min-w-0">
                <h3 className="text-lg sm:text-xl font-semibold text-gray-800 dark:text-white mb-2">AI Response</h3>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 break-words">
                  <span className="font-medium text-gray-700 dark:text-gray-300">Platform:</span>{' '}
                  <span className="capitalize">{aiAnswerContent.platform}</span>
                </p>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1 break-words">
                  <span className="font-medium text-gray-700 dark:text-gray-300">Prompt:</span> {aiAnswerContent.prompt}
                </p>
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-dark-800 rounded-lg p-4 mb-4 max-h-[50vh] overflow-y-auto">
              <p className="text-sm sm:text-base text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
                {aiAnswerContent.answer}
              </p>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setAiAnswerContent(null)}
                className="px-4 py-2 bg-gray-200 dark:bg-dark-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-dark-600 text-sm sm:text-base"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AllPrompts;
