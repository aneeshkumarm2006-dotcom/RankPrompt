import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Download, Search, ExternalLink } from 'lucide-react';
import html2pdf from 'html2pdf.js';

const SharedReport = () => {
  const { token } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [report, setReport] = useState(null);

  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [selectedPlatform, setSelectedPlatform] = useState('All Platforms');
  const [searchQuery, setSearchQuery] = useState('');

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

  const categories = useMemo(() => {
    const unique = new Set(reportData.map(item => item.category).filter(Boolean));
    return ['All Categories', ...unique];
  }, [reportData]);

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

  const handleDownloadPDF = () => {
    const element = document.getElementById('shared-report-content');
    const opt = {
      margin: 10,
      filename: `${report?.brandName || 'Report'}_Visibility_Analysis.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    };
    html2pdf().set(opt).from(element).save();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4" />
          <p className="text-gray-400">Loading shared report…</p>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 max-w-md text-center">
          <h1 className="text-2xl font-semibold text-white mb-3">Shared report unavailable</h1>
          <p className="text-gray-400 mb-6">{error || 'The shared link you used may have expired or been disabled.'}</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 rounded-xl bg-primary-500 text-white font-medium hover:bg-primary-600 transition-colors"
          >
            Go to RankPrompt
          </button>
        </div>
      </div>
    );
  }

  const totalPrompts = stats.totalPrompts ?? reportData.length;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-6xl mx-auto px-4 py-10" id="shared-report-content">
        {/* Header */}
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 mb-8 shadow-lg">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            <div>
              <p className="text-sm uppercase tracking-wider text-primary-400 mb-1">Shared Visibility Report</p>
              <h1 className="text-3xl md:text-4xl font-bold mb-2">{report.brandName} - Visibility Analysis</h1>
              <div className="flex flex-wrap items-center gap-3 text-gray-400">
                <span>{report.brandUrl}</span>
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

            <div className="flex flex-col md:items-end gap-3">
              <button
                onClick={handleDownloadPDF}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-700 hover:bg-gray-600 transition-colors"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </button>
              <button
                onClick={() => navigate('/login')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-500 hover:bg-primary-600 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Create Your Own Report
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-5">
            <p className="text-sm text-gray-400 mb-1">Total Prompts</p>
            <p className="text-3xl font-semibold">{totalPrompts}</p>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-5">
            <p className="text-sm text-gray-400 mb-1">Website Found</p>
            <p className="text-3xl font-semibold text-green-400">{stats.websiteFound ?? 0}</p>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-5">
            <p className="text-sm text-gray-400 mb-1">Brand Mentioned</p>
            <p className="text-3xl font-semibold text-blue-400">{stats.brandMentioned ?? 0}</p>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-5">
            <p className="text-sm text-gray-400 mb-1">Total Findings</p>
            <p className="text-3xl font-semibold text-purple-400">{stats.totalFindings ?? 0}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-5 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-primary-500"
              >
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Platform</label>
              <select
                value={selectedPlatform}
                onChange={(e) => setSelectedPlatform(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-primary-500"
              >
                <option value="All Platforms">All Platforms</option>
                <option value="chatgpt">ChatGPT</option>
                <option value="perplexity">Perplexity</option>
                <option value="google_ai_overviews">Google AI Overview</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Search Prompts</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-10 pr-4 py-2 text-white focus:outline-none focus:border-primary-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Results table */}
        <div className="bg-gray-800 border border-gray-700 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-850">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Prompt</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Platform Responses</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-750">
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="px-6 py-12 text-center text-gray-400">
                      No results found. Try different filters.
                    </td>
                  </tr>
                ) : (
                  filteredData.map((item, idx) => (
                    <tr key={`${item.prompt}-${idx}`} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 align-top">
                        <p className="text-white font-medium mb-2">{item.prompt}</p>
                        {item.success === false && (
                          <p className="text-sm text-red-400">Request failed: {item.error || 'Unknown error'}</p>
                        )}
                      </td>
                      <td className="px-6 py-4 align-top text-gray-300">
                        {item.category || '—'}
                      </td>
                      <td className="px-6 py-4 space-y-4">
                        {Array.isArray(item.response) ? (
                          item.response.map((platform, platformIdx) => (
                            <div
                              key={`${platform.src}-${platformIdx}`}
                              className="bg-gray-900 border border-gray-750 rounded-xl p-4"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-semibold text-primary-400 uppercase tracking-wide">
                                  {platform.src}
                                </span>
                                {platform.details?.website && (
                                  <a
                                    href={platform.details.website}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-400 hover:text-blue-300 underline"
                                  >
                                    View Source
                                  </a>
                                )}
                              </div>
                              {platform.answer && (
                                <p className="text-sm text-gray-200 whitespace-pre-line">{platform.answer}</p>
                              )}
                              <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-400">
                                {platform.details?.websiteFound && <span>✅ Website found</span>}
                                {platform.details?.brandMentionFound && <span>💬 Brand mentioned</span>}
                                {platform.details?.snippet && (
                                  <span className="italic text-gray-300">
                                    “{platform.details.snippet}”
                                  </span>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-gray-400">No platform response captured.</p>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-12 text-center text-gray-500 text-sm">
          <p>
            Want more visibility insights like this?{' '}
            <button
              onClick={() => navigate('/register')}
              className="text-primary-400 hover:text-primary-300 font-medium"
            >
              Create a free RankPrompt account
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SharedReport;
