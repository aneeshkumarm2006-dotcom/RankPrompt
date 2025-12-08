import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, TrendingUp, Eye, ExternalLink, CalendarIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const PerformanceSummary = ({ brandData, reports }) => {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [selectedPlatform, setSelectedPlatform] = useState('All Platforms');
  const [timeRange, setTimeRange] = useState('30');
  const [activeTab, setActiveTab] = useState('prompt-results');
  const [aiAnswerContent, setAiAnswerContent] = useState(null);
  const [citationContent, setCitationContent] = useState(null);
  const [hasScheduledReport, setHasScheduledReport] = useState(false);
  const [nextRunTime, setNextRunTime] = useState(null);
  const [sourcePromptsModal, setSourcePromptsModal] = useState(null);
  const [visibilityTrendData, setVisibilityTrendData] = useState([]);
  const [trendLoading, setTrendLoading] = useState(false);
  const [trendDateRange, setTrendDateRange] = useState({ startDate: '', endDate: '' });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [platformAverages, setPlatformAverages] = useState({ chatgpt: 0, perplexity: 0, googleAiOverviews: 0 });

  const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];

  // Check for scheduled reports
  useEffect(() => {
    const checkScheduledReports = async () => {
      if (!brandData?._id) return;
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      try {
        const response = await fetch(`${API_URL}/analysis/scheduled/${brandData._id}`, {
          credentials: 'include',
        });
        if (response.ok) {
          const { data } = await response.json();
          if (data && data.length > 0) {
            setHasScheduledReport(true);
            setNextRunTime(data[0].nextRun);
          }
        }
      } catch (error) {
        console.error('Error checking scheduled reports:', error);
      }
    };
    checkScheduledReports();
  }, [brandData]);

  // Fetch visibility trend data
  useEffect(() => {
    const fetchVisibilityTrend = async () => {
      if (!brandData?._id || reports.length < 2) {
        setVisibilityTrendData([]);
        return;
      }
      
      setTrendLoading(true);
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      try {
        let url = `${API_URL}/reports/brand/${brandData._id}/visibility-trend`;
        const params = new URLSearchParams();
        if (trendDateRange.startDate) params.append('startDate', trendDateRange.startDate);
        if (trendDateRange.endDate) params.append('endDate', trendDateRange.endDate);
        if (params.toString()) url += `?${params.toString()}`;

        const response = await fetch(url, {
          credentials: 'include',
        });
        
        if (response.ok) {
          const { data, averages } = await response.json();
          if (data && data.length > 0) {
            // Format dates for display
            const formattedData = data.map(item => ({
              ...item,
              date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            }));
            setVisibilityTrendData(formattedData);
            setPlatformAverages(averages || { chatgpt: 0, perplexity: 0, googleAiOverviews: 0 });
          } else {
            setVisibilityTrendData([]);
            setPlatformAverages({ chatgpt: 0, perplexity: 0, googleAiOverviews: 0 });
          }
        }
      } catch (error) {
        console.error('Error fetching visibility trend:', error);
        setVisibilityTrendData([]);
      } finally {
        setTrendLoading(false);
      }
    };
    
    fetchVisibilityTrend();
  }, [brandData, reports.length, trendDateRange]);

  // Handle date range apply
  const handleApplyDateRange = () => {
    setShowDatePicker(false);
    // The useEffect will automatically refetch with new date range
  };

  // Clear date range filter
  const handleClearDateRange = () => {
    setTrendDateRange({ startDate: '', endDate: '' });
    setShowDatePicker(false);
  };

  // Get aggregated data
  const getAggregatedData = () => {
    if (reports.length === 0) return null;

    const latestReport = reports[0];
    const reportData = latestReport?.reportData || [];

    // Category scores
    const categoryScores = {};
    reportData.forEach(item => {
      if (!categoryScores[item.category]) categoryScores[item.category] = { found: 0, total: 0 };
      item.response?.forEach(resp => {
        categoryScores[item.category].total++;
        if (resp.found) categoryScores[item.category].found++;
      });
    });

    const categoryData = Object.keys(categoryScores).map(cat => ({
      name: cat,
      visibility: Math.round((categoryScores[cat].found / categoryScores[cat].total) * 100) || 0
    })).sort((a, b) => b.visibility - a.visibility);

    // Platform scores
    const platformScores = {};
    reportData.forEach(item => {
      item.response?.forEach(resp => {
        if (!platformScores[resp.src]) platformScores[resp.src] = { found: 0, total: 0 };
        platformScores[resp.src].total++;
        if (resp.found) platformScores[resp.src].found++;
      });
    });

    const platformData = Object.keys(platformScores).map(platform => ({
      name: platform === 'google_ai_overviews' ? 'AI Overviews' : platform.charAt(0).toUpperCase() + platform.slice(1),
      score: Math.round((platformScores[platform].found / platformScores[platform].total) * 100) || 0
    }));

    // Ranked & missed prompts
    const rankedPrompts = [];
    const missedPrompts = [];
    
    reportData.forEach((item, idx) => {
      const responses = item.response || [];
      const foundCount = responses.filter(r => r.found).length;
      const platforms = responses.filter(r => r.found).map(r => r.src);
      const sources = responses.filter(r => r.details?.website || r.details?.matchedUrl);
      const aiModels = [...new Set(responses.map(r => r.src))];
      
      // Get the minimum index from all responses (the best rank across all AI models)
      const indices = responses.filter(r => r.index !== null && r.index !== undefined).map(r => r.index);
      const bestIndex = indices.length > 0 ? Math.min(...indices) : null;
      
      if (foundCount > 0) {
        rankedPrompts.push({
          index: bestIndex,
          prompt: item.prompt,
          category: item.category,
          rank: foundCount,
          platforms: [...new Set(platforms)],
          aiModels: aiModels,
          sources: sources.length,
          date: new Date(latestReport.reportDate || latestReport.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          responses: item.response,
        });
      } else {
        missedPrompts.push({
          index: bestIndex,
          prompt: item.prompt,
          category: item.category,
          rank: 'MISS',
          platforms: [],
          aiModels: aiModels,
          date: new Date(latestReport.reportDate || latestReport.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          responses: item.response,
        });
      }
    });

    // Sources with full prompt details
    const sourcesMap = {};
    reportData.forEach((item, idx) => {
      item.response?.forEach(resp => {
        const url = resp.details?.website || resp.details?.matchedUrl;
        if (url) {
          if (!sourcesMap[url]) sourcesMap[url] = { count: 0, prompts: [] };
          sourcesMap[url].count++;
          // Store full prompt details including response data
          sourcesMap[url].prompts.push({
            index: idx + 1,
            text: item.prompt,
            found: resp.found,
            platform: resp.src,
            aianswer: resp.aianswer,
            category: item.category
          });
        }
      });
    });

    const topSources = Object.entries(sourcesMap)
      .map(([url, data]) => ({ url, citations: data.count, prompts: data.prompts }))
      .sort((a, b) => b.citations - a.citations)
      .slice(0, 10);

    // Trend data
    const trendData = reports.map(report => ({
      date: new Date(report.reportDate || report.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      visibility: report.stats?.successRate || 0
    })).reverse().slice(-7);

    return {
      categoryData,
      platformData,
      rankedPrompts,
      missedPrompts,
      topSources,
      trendData,
      avgVisibility: latestReport.stats?.successRate || 0,
      foundInPrompts: rankedPrompts.length,
      missingFromPrompts: missedPrompts.length,
      totalSources: topSources.reduce((sum, s) => sum + s.citations, 0),
      categories: categoryData.length
    };
  };

  const data = getAggregatedData();

  // Custom tick component for multiline category names
  const CustomCategoryTick = ({ x, y, payload }) => {
    const name = payload.value || '';
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

  const calculateTimeRemaining = () => {
    if (!nextRunTime) return null;
    const now = new Date();
    const next = new Date(nextRunTime);
    const diff = next - now;
    if (diff <= 0) return 'Running soon...';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${days}d ${hours}h ${minutes}m`;
  };

  if (!data) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="text-center">
          <TrendingUp className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">No Reports Yet</h2>
          <p className="text-gray-600 mb-6">Create your first report to see visibility analytics</p>
          <button onClick={() => window.location.href = '/reports/new'} className="px-6 py-3 bg-[#4F46E5] text-white rounded-lg hover:bg-purple-700">
            Create First Report
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">Performance Summary</h1>
            <p className="text-gray-600 text-sm sm:text-base">Track your AI visibility across platforms</p>
          </div>
        {hasScheduledReport && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Calendar className="w-4 h-4" />
              <span>Next report in: <strong className="text-gray-800">{calculateTimeRemaining()}</strong></span>
            </div>
            <button
              onClick={() => navigate(`/brands/${brandData._id}/scheduled`)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors text-sm"
            >
              View Schedules
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg p-4 mb-6 border border-gray-200">
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 sm:gap-4">
          <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="w-full sm:w-auto px-4 py-2 bg-white text-gray-800 rounded-lg border border-[#CBD5E1] focus:border-[#4F46E5] focus:outline-none text-sm">
            <option>All Categories</option>
            {data.categoryData.map(cat => <option key={cat.name}>{cat.name}</option>)}
          </select>
          <select value={selectedPlatform} onChange={(e) => setSelectedPlatform(e.target.value)} className="w-full sm:w-auto px-4 py-2 bg-white text-gray-800 rounded-lg border border-[#CBD5E1] focus:border-[#4F46E5] focus:outline-none text-sm">
            <option>All Platforms</option>
            {data.platformData.map(plat => <option key={plat.name}>{plat.name}</option>)}
          </select>
          <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)} className="w-full sm:w-auto px-4 py-2 bg-white text-gray-800 rounded-lg border border-[#CBD5E1] focus:border-[#4F46E5] focus:outline-none text-sm">
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
          </select>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 mb-4 sm:mb-6">
        {/* Key Metrics */}
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <h3 className="text-lg sm:text-xl font-bold text-gray-800">Visibility Trend</h3>
            <div className="relative flex items-center gap-2">
              <button
                onClick={() => setShowDatePicker(!showDatePicker)}
                className="flex items-center gap-2 px-3 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors text-sm"
              >
                <CalendarIcon className="w-4 h-4" />
                {trendDateRange.startDate || trendDateRange.endDate ? 'Custom Range' : 'Select Range'}
              </button>
              {(trendDateRange.startDate || trendDateRange.endDate) && (
                <button
                  onClick={handleClearDateRange}
                  className="px-3 py-2 bg-gray-200 text-gray-500 rounded-lg hover:bg-gray-300 transition-colors text-sm"
                >
                  Clear
                </button>
              )}
              {showDatePicker && (
                <div className="fixed sm:absolute inset-x-4 sm:inset-x-auto top-1/2 sm:top-full right-auto sm:right-0 -translate-y-1/2 sm:translate-y-0 sm:mt-2 bg-white border border-gray-200 rounded-lg p-4 shadow-2xl z-50 w-auto sm:min-w-[280px] max-w-sm mx-auto sm:mx-0">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Start Date</label>
                      <input
                        type="date"
                        value={trendDateRange.startDate}
                        onChange={(e) => setTrendDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                        className="w-full px-3 py-2 bg-white text-gray-800 rounded border border-[#CBD5E1] focus:border-[#4F46E5] focus:outline-none text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">End Date</label>
                      <input
                        type="date"
                        value={trendDateRange.endDate}
                        onChange={(e) => setTrendDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                        className="w-full px-3 py-2 bg-white text-gray-800 rounded border border-[#CBD5E1] focus:border-[#4F46E5] focus:outline-none text-sm"
                      />
                    </div>
                    <button
                      onClick={handleApplyDateRange}
                      className="w-full px-4 py-2 bg-[#4F46E5] text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          {trendLoading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="text-gray-500 text-sm">Loading trend data...</div>
            </div>
          ) : visibilityTrendData.length > 1 ? (
            <>
              <div className="flex flex-wrap items-center gap-3 sm:gap-6 mb-4">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Avg ChatGPT</div>
                  <span className="text-xl sm:text-3xl font-bold text-green-500">{platformAverages.chatgpt}%</span>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Avg Perplexity</div>
                  <span className="text-xl sm:text-3xl font-bold text-purple-500">{platformAverages.perplexity}%</span>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Avg Google AI</div>
                  <span className="text-xl sm:text-3xl font-bold text-cyan-500">{platformAverages.googleAiOverviews}%</span>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Reports Analyzed</div>
                  <span className="text-xl sm:text-3xl font-bold text-gray-800">{visibilityTrendData.length}</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={200} className="text-xs sm:text-sm">
                <LineChart data={visibilityTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" stroke="#6b7280" style={{ fontSize: '10px' }} angle={-45} textAnchor="end" height={50} />
                  <YAxis stroke="#6b7280" style={{ fontSize: '10px' }} domain={[0, 100]} label={{ value: 'Visibility Score (%)', angle: -90, position: 'insideLeft', style: { fontSize: '10px', fill: '#6b7280' } }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#ffffff', 
                      border: '1px solid #e5e7eb', 
                      borderRadius: '8px',
                      fontSize: '12px'
                    }} 
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} iconSize={10} />
                  <Line 
                    type="monotone" 
                    dataKey="chatgpt" 
                    stroke="#10b981" 
                    strokeWidth={2} 
                    name="ChatGPT" 
                    dot={{ fill: '#10b981', r: 4 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="perplexity" 
                    stroke="#8b5cf6" 
                    strokeWidth={2} 
                    name="Perplexity" 
                    dot={{ fill: '#8b5cf6', r: 4 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="googleAiOverviews" 
                    stroke="#06b6d4" 
                    strokeWidth={2} 
                    name="Google AI" 
                    dot={{ fill: '#06b6d4', r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-sm sm:text-base">Not enough data to show trend</p>
                <p className="text-xs mt-1 text-gray-500">
                  {reports.length < 2 
                    ? 'Create at least 2 reports to see visibility trends'
                    : 'No reports found in selected date range'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Category Visibility Chart */}
        <div className="bg-white rounded-lg p-4 sm:p-6 border border-gray-200">
          <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">Category Visibility</h3>
          {data.categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200} className="text-xs sm:text-sm">
              <BarChart data={data.categoryData} margin={{ top: 5, right: 10, left: 0, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="name" 
                  stroke="#6b7280" 
                  angle={-45}
                  textAnchor="end"
                  height={50}
                  interval={0}
                  style={{ fontSize: '10px' }}
                />
                <YAxis stroke="#6b7280" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
                <Legend wrapperStyle={{ fontSize: '11px' }} iconSize={10} />
                <Bar dataKey="visibility" fill="#10B981" name="Visibility %" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">No category data</div>
          )}
          <div className="mt-2 text-sm text-gray-600">
            <p>Top: <span className="text-gray-800 font-bold">{data.categoryData[0]?.name || 'N/A'} ({data.categoryData[0]?.visibility || 0}%)</span></p>
          </div>
        </div>
      </div>

      {/* Platform Scores */}
      <div className="bg-white rounded-lg p-4 sm:p-6 border border-gray-200 mb-4 sm:mb-6">
        <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">Visibility Score by Platform</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data.platformData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" stroke="#6b7280" style={{ fontSize: '10px' }} />
            <YAxis stroke="#6b7280" style={{ fontSize: '10px' }} />
            <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
            <Bar dataKey="score" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="border-b border-gray-200 px-4 sm:px-6 py-4">
          <div className="flex items-center gap-4 sm:gap-6 overflow-x-auto">
            <button onClick={() => setActiveTab('prompt-results')} className={`${activeTab === 'prompt-results' ? 'text-[#4F46E5] border-b-2 border-[#4F46E5]' : 'text-gray-500 hover:text-gray-800'} font-semibold pb-2 whitespace-nowrap text-sm sm:text-base`}>
              Prompt Results
            </button>
            <button onClick={() => setActiveTab('sources')} className={`${activeTab === 'sources' ? 'text-[#4F46E5] border-b-2 border-[#4F46E5]' : 'text-gray-500 hover:text-gray-800'} font-semibold pb-2 whitespace-nowrap text-sm sm:text-base`}>
              Sources Ranking
            </button>
            <button onClick={() => setActiveTab('summary')} className={`${activeTab === 'summary' ? 'text-[#4F46E5] border-b-2 border-[#4F46E5]' : 'text-gray-500 hover:text-gray-800'} font-semibold pb-2 whitespace-nowrap text-sm sm:text-base`}>
              Results Summary
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          {/* Prompt Results Tab */}
          {activeTab === 'prompt-results' && (
            <div className="space-y-6">
              {/* Ranked */}
              <div>
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="text-green-500">✓</span> Ranked Prompts ({data.rankedPrompts.length})
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1000px]">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">AI</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prompt</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sources</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {data.rankedPrompts.slice(0, 10).map((p, i) => (
                        <tr key={i} className="hover:bg-gray-100">
                          <td className="px-4 py-3 text-sm text-gray-500">{p.date}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              {p.aiModels.map((model, idx) => (
                                <span key={idx} className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs capitalize">
                                  {model === 'chatgpt' ? 'GPT' : model === 'perplexity' ? 'PPX' : model === 'google_ai_overviews' ? 'AIO' : model}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-800 max-w-md truncate">{p.prompt}</td>
                          <td className="px-4 py-3"><span className="px-2 py-1 bg-green-100 text-green-600 rounded text-xs">{p.index !== null ? `#${p.index}` : '-'}</span></td>
                          <td className="px-4 py-3 text-sm text-gray-800">{p.sources}</td>
                          <td className="px-4 py-3">
                            <button 
                              onClick={() => {
                                // Find first found response to show
                                const foundResp = p.responses?.find(r => r.found);
                                if (foundResp) {
                                  setAiAnswerContent({
                                    answer: foundResp.aianswer || 'No AI answer available',
                                    platform: foundResp.src,
                                    prompt: p.prompt
                                  });
                                }
                              }}
                              className="text-primary-400 hover:text-primary-300 text-sm flex items-center gap-1"
                            >
                              <Eye className="w-4 h-4" /> View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Missed */}
              <div>
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="text-red-500">✗</span> Missed Prompts ({data.missedPrompts.length})
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1000px]">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">AI</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prompt</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sources</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {data.missedPrompts.slice(0, 10).map((p, i) => (
                        <tr key={i} className="hover:bg-gray-100">
                          <td className="px-4 py-3 text-sm text-gray-500">{p.date}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              {p.aiModels.map((model, idx) => (
                                <span key={idx} className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs capitalize">
                                  {model === 'chatgpt' ? 'GPT' : model === 'perplexity' ? 'PPX' : model === 'google_ai_overviews' ? 'AIO' : model}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-800 max-w-md truncate">{p.prompt}</td>
                          <td className="px-4 py-3"><span className="px-2 py-1 bg-red-100 text-red-600 rounded text-xs">{p.index !== null ? `#${p.index}` : 'MISS'}</span></td>
                          <td className="px-4 py-3 text-sm text-gray-800">0</td>
                          <td className="px-4 py-3">
                            <button 
                              onClick={() => {
                                // Show first response even if not found
                                const resp = p.responses?.[0];
                                if (resp) {
                                  setAiAnswerContent({
                                    answer: resp.aianswer || 'Brand not mentioned in this response',
                                    platform: resp.src,
                                    prompt: p.prompt
                                  });
                                }
                              }}
                              className="text-primary-400 hover:text-primary-300 text-sm flex items-center gap-1"
                            >
                              <Eye className="w-4 h-4" /> View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Sources Tab */}
          {activeTab === 'sources' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-800">Top Sources</h3>
                <button 
                  onClick={() => navigate(`/brands/${brandData._id}/citations`)}
                  className="text-[#4F46E5] hover:text-purple-700 text-sm font-medium"
                >
                  View All Citations →
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source URL</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Citations</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {data.topSources.map((source, index) => (
                      <tr key={index} className="hover:bg-gray-100">
                        <td className="px-4 py-3 text-sm font-medium text-gray-800">#{index + 1}</td>
                        <td className="px-4 py-3 text-sm text-[#4F46E5] hover:text-purple-700 truncate max-w-xs">
                          <a href={source.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                            {source.url}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-800">{source.citations} citations</td>
                        <td className="px-4 py-3">
                          <button 
                            onClick={() => setSourcePromptsModal(source)}
                            className="text-[#4F46E5] hover:text-purple-700 text-sm font-medium"
                          >
                            View Prompts
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Summary Tab */}
          {activeTab === 'summary' && (
            <div>
              <h3 className="text-lg font-bold text-gray-800 mb-6">Brand Overview</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div className="bg-gray-100 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2"><span className="text-green-500">✓</span><span className="text-gray-600 text-sm">Found In</span></div>
                  <span className="text-2xl font-bold text-gray-800">{data.foundInPrompts}</span><span className="text-gray-600 text-sm ml-1">prompts</span>
                </div>
                <div className="bg-gray-100 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2"><span className="text-red-500">✗</span><span className="text-gray-600 text-sm">Missing From</span></div>
                  <span className="text-2xl font-bold text-gray-800">{data.missingFromPrompts}</span><span className="text-gray-600 text-sm ml-1">prompts</span>
                </div>
                <div className="bg-gray-100 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2"><span className="text-blue-500">📊</span><span className="text-gray-600 text-sm">Total Reports</span></div>
                  <span className="text-2xl font-bold text-gray-800">{reports.length}</span><span className="text-gray-600 text-sm ml-1">reports</span>
                </div>
                <div className="bg-gray-100 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2"><span className="text-purple-500">🔗</span><span className="text-gray-600 text-sm">Total Sources</span></div>
                  <span className="text-2xl font-bold text-gray-800">{data.totalSources}</span><span className="text-gray-600 text-sm ml-1">sources</span>
                </div>
                <div className="bg-gray-100 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2"><span className="text-yellow-500">📁</span><span className="text-gray-600 text-sm">Categories</span></div>
                  <span className="text-2xl font-bold text-gray-800">{data.categories}</span><span className="text-gray-600 text-sm ml-1">categories</span>
                </div>
                <div className="bg-gray-750 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2"><span className="text-orange-400">📅</span><span className="text-gray-400 text-sm">Scheduled Reports</span></div>
                  <span className="text-2xl font-bold text-white">1</span><span className="text-gray-400 text-sm ml-1">active</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AI Answer Modal */}
      {aiAnswerContent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 sm:p-6 w-full max-w-4xl max-h-[85vh] overflow-y-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-3 mb-4">
              <div className="flex-1 min-w-0">
                <h3 className="text-lg sm:text-xl font-semibold text-white mb-2">AI Response</h3>
                <p className="text-xs sm:text-sm text-gray-400 break-words">
                  <span className="font-medium text-gray-300">Platform:</span> <span className="capitalize">{aiAnswerContent.platform}</span>
                </p>
                <p className="text-xs sm:text-sm text-gray-400 mt-1 break-words">
                  <span className="font-medium text-gray-300">Prompt:</span> {aiAnswerContent.prompt}
                </p>
              </div>
            </div>
            <div className="bg-gray-900 rounded-lg p-4 mb-4 max-h-[50vh] overflow-y-auto">
              <p className="text-sm sm:text-base text-gray-200 whitespace-pre-wrap leading-relaxed">{aiAnswerContent.answer}</p>
            </div>
            <div className="flex justify-end">
              <button onClick={() => setAiAnswerContent(null)} className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 text-sm sm:text-base">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Source Prompts Modal */}
      {sourcePromptsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 sm:p-6 w-full max-w-4xl max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg sm:text-xl font-semibold text-white mb-2">Prompts for Source</h3>
                <a href={sourcePromptsModal.url} target="_blank" rel="noopener noreferrer" className="text-xs sm:text-sm text-primary-400 hover:text-primary-300 flex items-center gap-1 break-all">
                  {sourcePromptsModal.url}
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                </a>
              </div>
              <button onClick={() => setSourcePromptsModal(null)} className="text-gray-400 hover:text-white">
                ✕
              </button>
            </div>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              {sourcePromptsModal.prompts.map((prompt, idx) => (
                <div key={idx} className="bg-gray-750 rounded-lg p-4 border border-gray-700">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-gray-400">Prompt #{prompt.index}</span>
                        {prompt.found ? (
                          <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs">✓ Found</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-xs">✗ Not Found</span>
                        )}
                        <span className="px-2 py-0.5 bg-gray-700 text-gray-300 rounded text-xs capitalize">
                          {prompt.platform === 'chatgpt' ? 'GPT' : prompt.platform === 'perplexity' ? 'PPX' : prompt.platform === 'google_ai_overviews' ? 'AIO' : prompt.platform}
                        </span>
                      </div>
                      <p className="text-sm text-gray-300">{prompt.text}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setAiAnswerContent({
                        answer: prompt.aianswer || 'No AI answer available',
                        platform: prompt.platform,
                        prompt: prompt.text
                      });
                      setSourcePromptsModal(null);
                    }}
                    className="text-primary-400 hover:text-primary-300 text-xs sm:text-sm flex items-center gap-1 mt-2"
                  >
                    <Eye className="w-3 h-3" /> View AI Response
                  </button>
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-4">
              <button onClick={() => setSourcePromptsModal(null)} className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 text-sm sm:text-base">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default PerformanceSummary;
