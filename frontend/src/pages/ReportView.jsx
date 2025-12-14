import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import { Download, Share2, ChevronDown, ExternalLink, Search, Calendar } from 'lucide-react';
import { generateReportPDF } from '../utils/pdfGenerator';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const ReportView = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { id: reportId } = useParams();
  const { reportData: stateReportData, brandData: stateBrandData } = location.state || {};

  const [reportData, setReportData] = useState(stateReportData);
  const [brandData, setBrandData] = useState(stateBrandData);
  const [loading, setLoading] = useState(!stateReportData && !!reportId);

  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [selectedPlatform, setSelectedPlatform] = useState('All Platforms');
  const [searchQuery, setSearchQuery] = useState('');
  const [citationContent, setCitationContent] = useState(null);
  const [aiAnswerContent, setAiAnswerContent] = useState(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleFrequency, setScheduleFrequency] = useState('weekly');
  const [scheduling, setScheduling] = useState(false);
  const [hasScheduledReport, setHasScheduledReport] = useState(false);

  // Track previous reportId to detect changes
  const prevReportIdRef = useRef(reportId);

  // Fetch report from API if ID is provided but no state data, or if reportId changes
  useEffect(() => {
    // If reportId changed (navigating to a different report), show loading
    if (reportId && reportId !== prevReportIdRef.current) {
      setLoading(true);
      setReportData(null);
      setBrandData(null);
      setHasScheduledReport(false); // Reset scheduled report state
      prevReportIdRef.current = reportId;
      
      const fetchReport = async () => {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        try {
          const response = await fetch(`${API_URL}/reports/${reportId}`, {
            credentials: 'include',
          });

          if (response.ok) {
            const { data } = await response.json();
            setReportData(data.reportData);
            const currentBrandId = data.brandId;
            setBrandData({
              brandName: data.brandName,
              websiteUrl: data.brandUrl,
              searchScope: data.searchScope,
              location: data.location,
              country: data.country,
              platforms: data.platforms,
              brandId: currentBrandId,
              reportDate: data.reportDate || data.createdAt,
            });

            // Check if THIS specific brand has scheduled reports
            if (currentBrandId) {
              try {
                const scheduledResponse = await fetch(
                  `${API_URL}/analysis/scheduled-prompts?brandId=${currentBrandId}&isActive=true`,
                  { credentials: 'include' }
                );
                if (scheduledResponse.ok) {
                  const scheduledData = await scheduledResponse.json();
                  // Verify that we found a scheduled prompt for THIS brandId
                  const hasScheduled = scheduledData.data && scheduledData.data.length > 0 && 
                    scheduledData.data.some(sp => sp.brandId === currentBrandId || String(sp.brandId) === String(currentBrandId));
                  setHasScheduledReport(hasScheduled);
                }
              } catch (err) {
                console.error('Error checking scheduled reports:', err);
                setHasScheduledReport(false);
              }
            } else {
              setHasScheduledReport(false);
            }
          } else {
            console.error('Failed to fetch report');
            navigate('/reports/new');
          }
        } catch (error) {
          console.error('Error fetching report:', error);
          navigate('/reports/new');
        } finally {
          setLoading(false);
        }
      };

      fetchReport();
    } else if (reportId && !stateReportData) {
      // Initial load with reportId but no state data
      setLoading(true);
      const fetchReport = async () => {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        try {
          const response = await fetch(`${API_URL}/reports/${reportId}`, {
            credentials: 'include',
          });

          if (response.ok) {
            const { data } = await response.json();
            setReportData(data.reportData);
            setBrandData({
              brandName: data.brandName,
              websiteUrl: data.brandUrl,
              searchScope: data.searchScope,
              location: data.location,
              country: data.country,
              platforms: data.platforms,
              brandId: data.brandId,
              reportDate: data.reportDate || data.createdAt,
            });

            // Check if THIS specific brand has scheduled reports
            const currentBrandId = data.brandId;
            if (currentBrandId) {
              try {
                const scheduledResponse = await fetch(
                  `${API_URL}/analysis/scheduled-prompts?brandId=${currentBrandId}&isActive=true`,
                  { credentials: 'include' }
                );
                if (scheduledResponse.ok) {
                  const scheduledData = await scheduledResponse.json();
                  // Verify that we found a scheduled prompt for THIS brandId
                  const hasScheduled = scheduledData.data && scheduledData.data.length > 0 && 
                    scheduledData.data.some(sp => sp.brandId === currentBrandId || String(sp.brandId) === String(currentBrandId));
                  setHasScheduledReport(hasScheduled);
                }
              } catch (err) {
                console.error('Error checking scheduled reports:', err);
                setHasScheduledReport(false);
              }
            } else {
              setHasScheduledReport(false);
            }
          } else {
            console.error('Failed to fetch report');
            navigate('/reports/new');
          }
        } catch (error) {
          console.error('Error fetching report:', error);
          navigate('/reports/new');
        } finally {
          setLoading(false);
        }
      };
      fetchReport();
    } else if (stateReportData && stateBrandData) {
      // If we have state data, use it and don't show loading
      setLoading(false);
      prevReportIdRef.current = reportId;
    }
  }, [reportId, stateReportData, stateBrandData, navigate]);

  if (loading) {
    return (
      <div className="flex h-screen bg-[#F8FAFC]">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading report...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!reportData || !brandData) {
    return (
      <div className="flex h-screen bg-[#F8FAFC]">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">No Report Data</h2>
            <button
              onClick={() => navigate('/reports/new')}
              className="px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
            >
              Create New Report
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Calculate statistics
  const totalPrompts = reportData.length;
  const platforms = ['chatgpt', 'perplexity', 'google_ai_overviews'];
  
  const stats = {
    totalPrompts: reportData.length,
    websiteFound: 0,
    brandMentioned: 0,
    totalFindings: 0,
  };

  // Platform-specific stats
  const platformStats = {
    chatgpt: { found: 0, total: 0 },
    perplexity: { found: 0, total: 0 },
    google_ai_overviews: { found: 0, total: 0 },
  };

  // Category-specific stats
  const categoryStats = {};

  reportData.forEach(item => {
    if (item.response && Array.isArray(item.response)) {
      item.response.forEach(platformData => {
        if (platformData.details?.websiteFound) stats.websiteFound++;
        if (platformData.details?.brandMentionFound) stats.brandMentioned++;
        if (platformData.found) stats.totalFindings++;

        // Track platform stats
        const platform = platformData.src;
        if (platformStats[platform]) {
          platformStats[platform].total++;
          if (platformData.found || platformData.details?.websiteFound || platformData.details?.brandMentionFound) {
            platformStats[platform].found++;
          }
        }

        // Track category stats
        const category = item.category || 'Uncategorized';
        if (!categoryStats[category]) {
          categoryStats[category] = { found: 0, total: 0 };
        }
        categoryStats[category].total++;
        if (platformData.found || platformData.details?.websiteFound || platformData.details?.brandMentionFound) {
          categoryStats[category].found++;
        }
      });
    }
  });

  // Prepare chart data for platform visibility
  const platformChartData = Object.entries(platformStats)
    .filter(([_, data]) => data.total > 0)
    .map(([platform, data]) => ({
      name: platform === 'google_ai_overviews' ? 'Google AI' : platform.charAt(0).toUpperCase() + platform.slice(1),
      visibility: data.total > 0 ? Math.round((data.found / data.total) * 100) : 0,
      score: data.total > 0 ? Math.round((data.found / data.total) * 100) : 0,
    }));

  // Prepare chart data for category visibility
  const categoryChartData = Object.entries(categoryStats)
    .map(([category, data]) => ({
      name: category,
      visibility: data.total > 0 ? Math.round((data.found / data.total) * 100) : 0,
      prompts: data.total,
    }))
    .sort((a, b) => b.visibility - a.visibility)
    .slice(0, 5); // Top 5 categories

  // Get unique categories
  const categories = ['All Categories', ...new Set(reportData.map(item => item.category))];

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

  // Filter data
  const filteredData = reportData.filter(item => {
    const matchesCategory = selectedCategory === 'All Categories' || item.category === selectedCategory;
    const matchesSearch = item.prompt.toLowerCase().includes(searchQuery.toLowerCase());
    
    let matchesPlatform = true;
    if (selectedPlatform !== 'All Platforms') {
      matchesPlatform = item.response?.some(r => r.src === selectedPlatform);
    }
    
    return matchesCategory && matchesSearch && matchesPlatform;
  });

  // Download report as PDF with much better quality
  const handleDownloadPDF = async () => {
    try {
      await generateReportPDF(
        brandData?.brandName || 'Brand',
        filteredData,
        stats,
        platformChartData,
        categoryChartData
      );
      toast.success('PDF downloaded successfully!');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF. Please try again.');
    }
  };

  // Share report (generate shareable link)
  const handleShareReport = async () => {
    if (!reportId) {
      toast.error('Report must be saved first before sharing');
      return;
    }

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    try {
      const response = await fetch(`${API_URL}/reports/${reportId}/share`, {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        const { data } = await response.json();
        navigator.clipboard.writeText(data.shareUrl);
        toast.success('Share link copied to clipboard! Anyone with this link can view your report.', {
          duration: 5000,
        });
      } else {
        toast.error('Failed to generate share link');
      }
    } catch (error) {
      console.error('Error sharing report:', error);
      toast.error('Error generating share link');
    }
  };

  const canSchedule = !!brandData?.brandId;

  const handleSchedule = async () => {
    if (!canSchedule) return;
    try {
      setScheduling(true);
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const resp = await fetch(`${API_URL}/analysis/schedule-from-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reportId, frequency: scheduleFrequency }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to schedule report');
      }
      setShowScheduleModal(false);
      setHasScheduledReport(true); // Update state after successful scheduling
      toast.success('Report scheduled successfully');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setScheduling(false);
    }
  };

    return (
    <div className="flex h-screen bg-[#F8FAFC]">
      <Sidebar />
      
      <div className="flex-1 overflow-auto lg:ml-64 mt-16 lg:mt-0">
        <div className="max-w-7xl mx-auto p-4 sm:p-6" id="report-content">
          {/* Header */}
          <div className="bg-white rounded-lg p-4 sm:p-6 mb-4 sm:mb-6 border border-gray-200">
            <div className="flex flex-col lg:flex-row justify-between items-start gap-4 mb-4">
              <div className="min-w-0 w-full lg:w-auto">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2 break-words">
                  {brandData?.brandName || 'Brand'} - Visibility Analysis
                </h1>
                <p className="text-sm sm:text-base text-gray-600 break-all">
                  {brandData?.websiteUrl || 'N/A'} • {brandData?.reportDate ? new Date(brandData.reportDate).toLocaleString() : 'N/A'}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full lg:w-auto">
                <button
                  onClick={handleDownloadPDF}
                  className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors text-sm sm:text-base whitespace-nowrap"
                >
                  <Download className="w-4 h-4 flex-shrink-0" />
                  Download PDF
                </button>
                <button
                  onClick={handleShareReport}
                  className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors text-sm sm:text-base whitespace-nowrap"
                >
                  <Share2 className="w-4 h-4 flex-shrink-0" />
                  Share Report
                </button>
                {canSchedule && (
                  hasScheduledReport ? (
                    <button
                      onClick={() => navigate(`/brands/${brandData.brandId}/scheduled`)}
                      className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm sm:text-base whitespace-nowrap"
                    >
                      <Calendar className="w-4 h-4" />
                      View Scheduled Reports
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowScheduleModal(true)}
                      className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm sm:text-base whitespace-nowrap"
                    >
                      <Calendar className="w-4 h-4" />
                      Schedule Report
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-4 sm:mt-6">
              <div className="bg-gray-100 rounded-lg p-3 sm:p-4">
                <div className="text-gray-600 text-xs sm:text-sm mb-1">Total Prompts</div>
                <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800">{totalPrompts}</div>
              </div>
              <div className="bg-gray-100 rounded-lg p-3 sm:p-4">
                <div className="text-gray-600 text-xs sm:text-sm mb-1">Website Found</div>
                <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-green-500">{stats.websiteFound}</div>
              </div>
              <div className="bg-gray-100 rounded-lg p-3 sm:p-4">
                <div className="text-gray-600 text-xs sm:text-sm mb-1">Brand Mentioned</div>
                <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-blue-500">{stats.brandMentioned}</div>
              </div>
              <div className="bg-gray-100 rounded-lg p-3 sm:p-4">
                <div className="text-gray-600 text-xs sm:text-sm mb-1">Total Findings</div>
                <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-purple-500">{stats.totalFindings}</div>
              </div>
            </div>
          </div>

          {/* Visibility Analysis Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
            {/* Visibility Score by Platform */}
            <div className="bg-white rounded-lg p-4 sm:p-6 border border-gray-200">
              <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-2 sm:mb-4">Visibility Score by Platform</h3>
              {platformChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={450}>
                  <BarChart data={platformChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="name" stroke="#6B7280" tick={{ fontSize: 12 }} />
                    <YAxis stroke="#6B7280" tick={{ fontSize: 12 }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '8px' }}
                      labelStyle={{ color: '#1F2937' }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '10px' }} />
                    <Bar dataKey="visibility" fill="#8B5CF6" name="Visibility %" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-64 text-gray-600">
                  No platform data available
                </div>
              )}
              <div className="mt-2 text-sm text-gray-600">
                <p>Overall Visibility Score: <span className="text-gray-800 font-bold">{platformChartData.length > 0 ? Math.round(platformChartData.reduce((acc, p) => acc + p.score, 0) / platformChartData.length) : 0}%</span></p>
              </div>
            </div>

            {/* Category Visibility Trends */}
            <div className="bg-white rounded-lg p-4 sm:p-6 border border-gray-200">
              <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-2 sm:mb-4">Category Visibility Trends</h3>
              {categoryChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={450}>
                  <BarChart data={categoryChartData} margin={{ top: 5, right: 10, left: 0, bottom: 70 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis 
                      dataKey="name" 
                      stroke="#6B7280" 
                      angle={0}
                      textAnchor="middle"
                      height={70}
                      tick={<CustomCategoryTick />}
                    />
                    <YAxis stroke="#6B7280" tick={{ fontSize: 12 }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '8px' }}
                      labelStyle={{ color: '#1F2937' }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '10px' }} />
                    <Bar dataKey="visibility" fill="#10B981" name="Visibility %" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-64 text-gray-600">
                  No category data available
                </div>
              )}
              <div className="mt-2 text-sm text-gray-600">
                <p>Top performing category: <span className="text-gray-800 font-bold">{categoryChartData[0]?.name || 'N/A'} ({categoryChartData[0]?.visibility || 0}%)</span></p>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg p-4 sm:p-6 mb-4 sm:mb-6 border border-gray-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
              {/* Category Filter */}
              <div className="relative">
                <label className="block text-xs sm:text-sm font-medium text-gray-600 mb-2">Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full bg-gray-100 text-gray-800 rounded-lg px-3 sm:px-4 py-2 border border-gray-300 focus:border-primary-500 focus:outline-none text-sm sm:text-base"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Platform Filter */}
              <div className="relative">
                <label className="block text-xs sm:text-sm font-medium text-gray-600 mb-2">Platform</label>
                <select
                  value={selectedPlatform}
                  onChange={(e) => setSelectedPlatform(e.target.value)}
                  className="w-full bg-gray-100 text-gray-800 rounded-lg px-3 sm:px-4 py-2 border border-gray-300 focus:border-primary-500 focus:outline-none text-sm sm:text-base"
                >
                  <option value="All Platforms">All Platforms</option>
                  <option value="chatgpt">ChatGPT</option>
                  <option value="perplexity">Perplexity</option>
                  <option value="google_ai_overviews">Google AI Overview</option>
                </select>
              </div>

              {/* Search */}
              <div className="relative sm:col-span-2 md:col-span-1">
                <label className="block text-xs sm:text-sm font-medium text-gray-600 mb-2">Search Prompts</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search..."
                    className="w-full bg-gray-100 text-gray-800 rounded-lg pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 border border-gray-300 focus:border-primary-500 focus:outline-none text-sm sm:text-base"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Results Table */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Prompt
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Platform
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      Found
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Index
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Website
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Brand Mention
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">AI Response</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Snippet</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Citation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredData.map((item, idx) => (
                    item.response && Array.isArray(item.response) ? (
                      item.response.map((platformData, pIdx) => (
                        <tr key={`${idx}-${pIdx}`} className="hover:bg-gray-50 transition-colors">
                          {pIdx === 0 && (
                            <td className="px-3 py-3 text-sm text-gray-700" rowSpan={item.response.length}>
                              {item.prompt}
                            </td>
                          )}
                          {pIdx === 0 && (
                            <td className="px-3 py-3 text-sm text-gray-600" rowSpan={item.response.length}>
                              <span className="px-2 py-1 bg-gray-200 rounded-full text-xs">
                                {item.category}
                              </span>
                            </td>
                          )}
                          <td className="px-3 py-3 text-sm text-gray-700 capitalize whitespace-nowrap">
                            {platformData.src === 'google_ai_overviews' ? 'Google AI' : platformData.src}
                          </td>
                          <td className="px-3 py-3 text-sm whitespace-nowrap">
                            {platformData.found ? (
                              <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                                ✓ Yes
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                                ✗ No
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-sm text-gray-700 whitespace-nowrap">
                            {platformData.index !== null ? `#${platformData.index}` : '-'}
                          </td>
                          <td className="px-3 py-3 text-sm whitespace-nowrap">
                            {platformData.details?.websiteFound ? (
                              platformData.details?.website ? (
                                <a href={platformData.details.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline text-xs">View Source</a>
                              ) : (
                                <span className="text-green-600">✓ Yes</span>
                              )
                            ) : (
                              <span className="text-red-600">✗ No</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-sm whitespace-nowrap">
                            {platformData.details?.brandMentionFound ? (
                              <span className="text-green-600">✓ Yes</span>
                            ) : (
                              <span className="text-red-600">✗ No</span>
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
                                className="px-2 py-1 text-xs bg-primary-500 hover:bg-primary-600 text-white rounded whitespace-nowrap"
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
                                className="px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 text-gray-800 rounded whitespace-nowrap"
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
                                href={platformData.details.website || platformData.details.matchedUrl} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 underline text-xs"
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
                      <tr key={idx} className="hover:bg-gray-50">
                        <td colSpan="11" className="px-3 py-3 text-sm text-gray-500 text-center">
                          No response data
                        </td>
                      </tr>
                    )
                  ))}
                </tbody>
              </table>
            </div>

            {filteredData.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-600">No results found</p>
              </div>
            )}
          </div>
          {/* Schedule Modal */}
          {showScheduleModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6 w-full max-w-md">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Schedule this report</h3>
                <label className="block text-sm text-gray-700 mb-2">Frequency</label>
                <select
                  value={scheduleFrequency}
                  onChange={(e) => setScheduleFrequency(e.target.value)}
                  className="w-full bg-gray-100 text-gray-800 rounded-lg px-4 py-2 border border-gray-300 focus:border-primary-500 focus:outline-none mb-4"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
                <div className="flex justify-end gap-3">
                  <button onClick={() => setShowScheduleModal(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button>
                  <button onClick={handleSchedule} disabled={scheduling} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{scheduling ? 'Scheduling...' : 'Confirm'}</button>
                </div>
              </div>
            </div>
          )}

          {/* Citation Modal */}
          {citationContent && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
                <h3 className="text-lg sm:text-xl font-semibold text-gray-800 mb-4">Snippet</h3>
                {citationContent.citation ? (
                  <p className="text-sm sm:text-base text-gray-700 whitespace-pre-line mb-4">{citationContent.citation}</p>
                ) : (
                  <p className="text-sm text-gray-600 mb-4">No snippet available.</p>
                )}
                {citationContent.website && (
                  <a href={citationContent.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 underline text-sm sm:text-base">
                    <ExternalLink className="w-4 h-4" />
                    Open Source
                  </a>
                )}
                <div className="flex justify-end mt-6">
                  <button onClick={() => setCitationContent(null)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 text-sm sm:text-base">Close</button>
                </div>
              </div>
            </div>
          )}

          {/* AI Answer Modal */}
          {aiAnswerContent && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6 w-full max-w-4xl max-h-[85vh] overflow-y-auto">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-3 mb-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg sm:text-xl font-semibold text-gray-800 mb-2">AI Response</h3>
                    <p className="text-xs sm:text-sm text-gray-600 break-words">
                      <span className="font-medium text-gray-700">Platform:</span> <span className="capitalize">{aiAnswerContent.platform}</span>
                    </p>
                    <p className="text-xs sm:text-sm text-gray-600 mt-1 break-words">
                      <span className="font-medium text-gray-700">Prompt:</span> {aiAnswerContent.prompt}
                    </p>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 mb-4 max-h-[50vh] overflow-y-auto">
                  <p className="text-sm sm:text-base text-gray-700 whitespace-pre-wrap leading-relaxed">{aiAnswerContent.answer}</p>
                </div>
                <div className="flex justify-end">
                  <button onClick={() => setAiAnswerContent(null)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 text-sm sm:text-base">Close</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportView;