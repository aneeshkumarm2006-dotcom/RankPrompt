import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Download, Search, ExternalLink, CheckCircle2, XCircle } from 'lucide-react';
import { generateReportPDF } from '../utils/pdfGenerator';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const SharedReport = () => {
  const { token } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [report, setReport] = useState(null);

  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [selectedPlatform, setSelectedPlatform] = useState('All Platforms');
  const [searchQuery, setSearchQuery] = useState('');
  const [citationContent, setCitationContent] = useState(null);
  const [aiAnswerContent, setAiAnswerContent] = useState(null);

  useEffect(() => {
    const fetchSharedReport = async () => {
      setLoading(true);
      setError(null);

      try {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const response = await fetch(`${API_URL}/reports/shared/${token}`);

        if (!response.ok) {
          throw new Error('This shared report is unavailable or has been revoked.');
        }

        const { data } = await response.json();
        setReport(data);
      } catch (err) {
        console.error('Failed to load shared report:', err);
        setError(err.message || 'Unable to load shared report.');
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchSharedReport();
    }
  }, [token]);

  const reportData = report?.reportData || [];
  const stats = report?.stats || {};

  // Platform-specific stats
  const platformStats = useMemo(() => {
    const stats = {
      chatgpt: { found: 0, total: 0 },
      perplexity: { found: 0, total: 0 },
      google_ai_overviews: { found: 0, total: 0 },
    };

    reportData.forEach(item => {
      if (item.response && Array.isArray(item.response)) {
        item.response.forEach(platformData => {
          const platform = platformData.src;
          if (stats[platform]) {
            stats[platform].total++;
            if (platformData.found || platformData.details?.websiteFound || platformData.details?.brandMentionFound) {
              stats[platform].found++;
            }
          }
        });
      }
    });

    return stats;
  }, [reportData]);

  // Category-specific stats
  const categoryStats = useMemo(() => {
    const stats = {};

    reportData.forEach(item => {
      if (item.response && Array.isArray(item.response)) {
        item.response.forEach(platformData => {
          const category = item.category || 'Uncategorized';
          if (!stats[category]) {
            stats[category] = { found: 0, total: 0 };
          }
          stats[category].total++;
          if (platformData.found || platformData.details?.websiteFound || platformData.details?.brandMentionFound) {
            stats[category].found++;
          }
        });
      }
    });

    return stats;
  }, [reportData]);

  // Prepare chart data for platform visibility
  const platformChartData = useMemo(() => {
    return Object.entries(platformStats)
      .filter(([_, data]) => data.total > 0)
      .map(([platform, data]) => ({
        name: platform === 'google_ai_overviews' ? 'Google AI' : platform.charAt(0).toUpperCase() + platform.slice(1),
        visibility: data.total > 0 ? Math.round((data.found / data.total) * 100) : 0,
        score: data.total > 0 ? Math.round((data.found / data.total) * 100) : 0,
      }));
  }, [platformStats]);

  // Prepare chart data for category visibility
  const categoryChartData = useMemo(() => {
    return Object.entries(categoryStats)
      .map(([category, data]) => ({
        name: category,
        visibility: data.total > 0 ? Math.round((data.found / data.total) * 100) : 0,
        prompts: data.total,
      }))
      .sort((a, b) => b.visibility - a.visibility)
      .slice(0, 5);
  }, [categoryStats]);

  const categories = useMemo(() => {
    const unique = new Set(reportData.map(item => item.category).filter(Boolean));
    return ['All Categories', ...unique];
  }, [reportData]);

  // Custom tick component for multiline category names
  const CustomCategoryTick = ({ x, y, payload }) => {
    const name = payload.value || '';
    // Split long category names into multiple lines (max 18 chars per line)
    const maxLength = 18;
    let lines = [];
    
    if (name.length <= maxLength) {
      lines = [name];
    } else {
      const words = name.split(' ');
      let currentLine = '';
      
      words.forEach(word => {
        if ((currentLine + word).length <= maxLength) {
          currentLine += (currentLine ? ' ' : '') + word;
        } else {
          if (currentLine) lines.push(currentLine);
          currentLine = word;
        }
      });
      if (currentLine) lines.push(currentLine);
    }
    
    return (
      <g transform={`translate(${x},${y})`}>
        <text x={0} y={0} dy={16} textAnchor="middle" fill="#9CA3AF" fontSize={11}>
          {lines.map((line, index) => (
            <tspan x={0} dy={index === 0 ? 0 : 14} key={index}>
              {line}
            </tspan>
          ))}
        </text>
      </g>
    );
  };

  const filteredData = useMemo(() => {
    return reportData.filter(item => {
      const matchesCategory = selectedCategory === 'All Categories' || item.category === selectedCategory;
      const matchesSearch = item.prompt?.toLowerCase().includes(searchQuery.toLowerCase());
      let matchesPlatform = true;

      if (selectedPlatform !== 'All Platforms') {
        matchesPlatform = item.response?.some(r => r.src === selectedPlatform);
      }

      return matchesCategory && matchesSearch && matchesPlatform;
    });
  }, [reportData, selectedCategory, searchQuery, selectedPlatform]);

  const handleDownloadPDF = async () => {
    try {
      await generateReportPDF(
        report?.brandName || 'Brand',
        filteredData,
        stats,
        platformChartData,
        categoryChartData
      );
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-950 flex items-center justify-center">
        <div className="text-center py-12">
          <p className="text-gray-600 dark:text-gray-400">No results found</p>
        </div>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4F46E5] mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400">Loading shared report…</p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-950 flex items-center justify-center px-4">
        <div className="bg-white dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-2xl p-8 max-w-md text-center shadow-lg">
          <h1 className="text-2xl font-semibold text-gray-800 dark:text-white mb-3">Shared report unavailable</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error || 'The shared link you used may have expired or been disabled.'}</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 rounded-xl bg-[#4F46E5] text-white font-medium hover:bg-purple-700 transition-colors"
          >
            Go to PromptVerse
          </button>
        </div>
      </div>
    );
  }

  const totalPrompts = stats.totalPrompts ?? reportData.length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-950 text-gray-800 dark:text-gray-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10" id="shared-report-content">
        {/* Header */}
        <div className="bg-white dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-xl sm:rounded-2xl p-4 sm:p-6 mb-6 sm:mb-8 shadow-lg">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 sm:gap-6">
            <div className="min-w-0">
              <p className="text-xs sm:text-sm uppercase tracking-wider text-primary-500 dark:text-primary-400 mb-1">Shared Visibility Report</p>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800 dark:text-white mb-2 break-words">{report.brandName} - Visibility Analysis</h1>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                <span className="break-all">{report.brandUrl}</span>
                <span className="hidden md:inline">•</span>
                <span>{new Date(report.reportDate || report.createdAt).toLocaleString()}</span>
                <span className="hidden md:inline">•</span>
                <span className="capitalize">{report.searchScope} search</span>
                {report.location && (
                  <>
                    <span className="hidden md:inline">•</span>
                    <span>{report.location}, {report.country}</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row lg:flex-col lg:items-end gap-2 sm:gap-3 w-full lg:w-auto">
              <button
                onClick={handleDownloadPDF}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gray-200 dark:bg-dark-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-dark-600 transition-colors text-sm sm:text-base whitespace-nowrap"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </button>
              <button
                onClick={() => navigate('/login')}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-primary-500 text-white hover:bg-primary-600 transition-colors text-sm sm:text-base whitespace-nowrap"
              >
                <ExternalLink className="w-4 h-4" />
                Create Your Own Report
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="bg-white dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-xl sm:rounded-2xl p-3 sm:p-5">
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1">Total Prompts</p>
            <p className="text-xl sm:text-2xl lg:text-3xl font-semibold text-gray-800 dark:text-white">{totalPrompts}</p>
          </div>
          <div className="bg-white dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-xl sm:rounded-2xl p-3 sm:p-5">
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1">Website Found</p>
            <p className="text-xl sm:text-2xl lg:text-3xl font-semibold text-green-500">{stats.websiteFound ?? 0}</p>
          </div>
          <div className="bg-white dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-xl sm:rounded-2xl p-3 sm:p-5">
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1">Brand Mentioned</p>
            <p className="text-xl sm:text-2xl lg:text-3xl font-semibold text-blue-500">{stats.brandMentioned ?? 0}</p>
          </div>
          <div className="bg-white dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-xl sm:rounded-2xl p-3 sm:p-5">
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1">Total Findings</p>
            <p className="text-xl sm:text-2xl lg:text-3xl font-semibold text-purple-500">{stats.totalFindings ?? 0}</p>
          </div>
        </div>

        {/* Visibility Analysis Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* Visibility Score by Platform */}
          <div className="bg-white dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-xl sm:rounded-2xl p-4 sm:p-6">
            <h3 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white mb-2 sm:mb-4">Visibility Score by Platform</h3>
            {platformChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={450}>
                <BarChart data={platformChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fontSize: 12, fill: '#9CA3AF' }} />
                  <YAxis stroke="#9CA3AF" tick={{ fontSize: 12, fill: '#9CA3AF' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                    labelStyle={{ color: '#F9FAFB' }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '10px' }} />
                  <Bar dataKey="visibility" fill="#8B5CF6" name="Visibility %" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-400 dark:text-gray-500">
                No platform data available
              </div>
            )}
            <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              <p>Overall Visibility Score: <span className="text-gray-800 dark:text-white font-bold">{platformChartData.length > 0 ? Math.round(platformChartData.reduce((acc, p) => acc + p.score, 0) / platformChartData.length) : 0}%</span></p>
            </div>
          </div>

          {/* Category Visibility Trends */}
          <div className="bg-white dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-xl sm:rounded-2xl p-4 sm:p-6">
            <h3 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white mb-2 sm:mb-4">Category Visibility Trends</h3>
            {categoryChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={450}>
                <BarChart data={categoryChartData} margin={{ top: 5, right: 10, left: 0, bottom: 70 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="name" 
                    stroke="#9CA3AF" 
                    angle={0}
                    textAnchor="middle"
                    height={70}
                    interval={0}
                    width={120}
                    tick={<CustomCategoryTick />}
                  />
                  <YAxis stroke="#9CA3AF" tick={{ fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                    labelStyle={{ color: '#F9FAFB' }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '10px' }} />
                  <Bar dataKey="visibility" fill="#10B981" name="Visibility %" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-400 dark:text-gray-500">
                No category data available
              </div>
            )}
            <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              <p>Top performing category: <span className="text-gray-800 dark:text-white font-bold">{categoryChartData[0]?.name || 'N/A'} ({categoryChartData[0]?.visibility || 0}%)</span></p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-xl sm:rounded-2xl p-4 sm:p-5 mb-6 sm:mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full bg-white dark:bg-dark-800 border border-gray-300 dark:border-dark-600 rounded-xl px-3 sm:px-4 py-2 text-gray-800 dark:text-gray-200 focus:outline-none focus:border-primary-500 text-sm sm:text-base"
              >
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Platform</label>
              <select
                value={selectedPlatform}
                onChange={(e) => setSelectedPlatform(e.target.value)}
                className="w-full bg-white dark:bg-dark-800 border border-gray-300 dark:border-dark-600 rounded-xl px-3 sm:px-4 py-2 text-gray-800 dark:text-gray-200 focus:outline-none focus:border-primary-500 text-sm sm:text-base"
              >
                <option value="All Platforms">All Platforms</option>
                <option value="chatgpt">ChatGPT</option>
                <option value="perplexity">Perplexity</option>
                <option value="google_ai_overviews">Google AI Overview</option>
              </select>
            </div>

            <div className="sm:col-span-2 md:col-span-1">
              <label className="block text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Search Prompts</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-500 dark:text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="w-full bg-white border border-gray-300 rounded-xl pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 text-gray-800 focus:outline-none focus:border-[#4F46E5] text-sm sm:text-base"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Results Table - Identical to ReportView */}
        <div className="bg-white dark:bg-dark-900 rounded-lg border border-gray-200 dark:border-dark-700">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px]">
              <thead className="bg-gray-50 dark:bg-dark-800">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Prompt
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Platform
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    Found
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Index
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Website
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Brand Mention
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">AI Response</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Snippet</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Citation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
                {filteredData.map((item, idx) => (
                  item.response && Array.isArray(item.response) ? (
                    item.response.map((platformData, pIdx) => (
                      <tr key={`${idx}-${pIdx}`} className="hover:bg-gray-100 dark:hover:bg-dark-800 transition-colors">
                        {pIdx === 0 && (
                          <td className="px-3 py-3 text-sm text-gray-800 dark:text-gray-200" rowSpan={item.response.length}>
                            {item.prompt}
                          </td>
                        )}
                        {pIdx === 0 && (
                          <td className="px-3 py-3 text-sm text-gray-600 dark:text-gray-400" rowSpan={item.response.length}>
                            <span className="px-2 py-1 bg-gray-200 dark:bg-dark-700 rounded-full text-xs">
                              {item.category}
                            </span>
                          </td>
                        )}
                        <td className="px-3 py-3 text-sm text-gray-800 dark:text-gray-200 capitalize whitespace-nowrap">
                          {platformData.src === 'google_ai_overviews' ? 'Google AI' : platformData.src}
                        </td>
                        <td className="px-3 py-3 text-sm whitespace-nowrap">
                          {platformData.found ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-600 rounded-full text-xs font-medium">
                              <CheckCircle2 className="w-3 h-3" />
                              Yes
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-600 rounded-full text-xs font-medium">
                              <XCircle className="w-3 h-3" />
                              No
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-800 dark:text-gray-200 whitespace-nowrap">
                          {platformData.index !== null ? `#${platformData.index}` : '-'}
                        </td>
                        <td className="px-3 py-3 text-sm whitespace-nowrap">
                          {platformData.details?.websiteFound ? (
                            platformData.details?.website ? (
                              <a href={platformData.details.website} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 underline text-xs">View Source</a>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-green-500">
                                <CheckCircle2 className="w-3 h-3" />
                                Yes
                              </span>
                            )
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-sm whitespace-nowrap">
                          {platformData.details?.brandMentionFound ? (
                            <span className="inline-flex items-center gap-1 text-blue-500">
                              <CheckCircle2 className="w-3 h-3" />
                              Yes
                            </span>
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-sm whitespace-nowrap">
                          {platformData.aianswer ? (
                            <button
                              onClick={() => setAiAnswerContent({
                                platform: platformData.src === 'google_ai_overviews' ? 'Google AI' : platformData.src,
                                answer: platformData.aianswer,
                                prompt: item.prompt
                              })}
                              className="px-2 py-1 text-xs bg-purple-600 hover:bg-purple-700 dark:bg-action-600 dark:hover:bg-action-700 text-white rounded whitespace-nowrap"
                            >
                              View Response
                            </button>
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-sm whitespace-nowrap">
                          {platformData.details?.snippet ? (
                            <button
                              onClick={() => setCitationContent({
                                citation: platformData.details?.snippet || '',
                                website: platformData.details?.website || platformData.details?.matchedUrl || null,
                              })}
                              className="px-2 py-1 text-xs bg-gray-200 dark:bg-dark-700 hover:bg-gray-300 dark:hover:bg-dark-600 text-gray-800 dark:text-gray-200 rounded whitespace-nowrap"
                            >
                              View Snippet
                            </button>
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-sm whitespace-nowrap">
                          {platformData.details?.website || platformData.details?.matchedUrl ? (
                            <a 
                              href={platformData.details?.website || platformData.details?.matchedUrl} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 underline text-xs flex items-center gap-1"
                            >
                              <ExternalLink className="w-3 h-3" />
                              Link
                            </a>
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr key={idx} className="hover:bg-gray-100 transition-colors">
                      <td colSpan="11" className="px-3 py-3 text-sm text-gray-600 dark:text-gray-400">
                        <div className="text-gray-800 dark:text-gray-200">{item.prompt}</div>
                        <div className="text-red-500 text-xs mt-1">No platform response captured</div>
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
            </div>
          </div>

        {/* Snippet Modal */}
        {citationContent && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-lg p-4 sm:p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-800 dark:text-white mb-4">Snippet</h3>
              {citationContent.citation ? (
                <p className="text-sm sm:text-base text-gray-800 dark:text-gray-200 whitespace-pre-line mb-4">{citationContent.citation}</p>
              ) : (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">No snippet available.</p>
              )}
              {citationContent.website && (
                <a href={citationContent.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 underline text-sm sm:text-base">
                  <ExternalLink className="w-4 h-4" />
                  Open Source
                </a>
              )}
              <div className="flex justify-end mt-6">
                <button onClick={() => setCitationContent(null)} className="px-4 py-2 bg-gray-200 dark:bg-dark-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-dark-600 text-sm sm:text-base">Close</button>
              </div>
            </div>
          </div>
        )}

        {/* AI Answer Modal */}
        {aiAnswerContent && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-lg p-4 sm:p-6 w-full max-w-4xl max-h-[85vh] overflow-y-auto">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-3 mb-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg sm:text-xl font-semibold text-gray-800 dark:text-white mb-2">AI Response</h3>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 break-words">
                    <span className="font-medium text-gray-700 dark:text-gray-300">Platform:</span> <span className="capitalize">{aiAnswerContent.platform}</span>
                  </p>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1 break-words">
                    <span className="font-medium text-gray-700 dark:text-gray-300">Prompt:</span> {aiAnswerContent.prompt}
                  </p>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-dark-800 rounded-lg p-4 mb-4 max-h-[50vh] overflow-y-auto">
                <p className="text-sm sm:text-base text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">{aiAnswerContent.answer}</p>
              </div>
              <div className="flex justify-end">
                <button onClick={() => setAiAnswerContent(null)} className="px-4 py-2 bg-gray-200 dark:bg-dark-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-dark-600 text-sm sm:text-base">Close</button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-12 text-center text-gray-600 dark:text-gray-400 text-sm">
          <p>
            Want more visibility insights like this?{' '}
            <button
              onClick={() => navigate('/register')}
              className="text-primary-500 hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300 font-medium"
            >
              Create a free PromptVerse account
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SharedReport;
