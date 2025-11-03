import { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { Download, Share2, ChevronDown, ExternalLink, Search } from 'lucide-react';
import html2pdf from 'html2pdf.js';

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

  // Fetch report from API if ID is provided but no state data
  useEffect(() => {
    if (reportId && !stateReportData) {
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
            });
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
    }
  }, [reportId, stateReportData, navigate]);

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-900">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading report...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="flex h-screen bg-gray-900">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white mb-4">No Report Data</h2>
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
    websiteFound: 0,
    brandMentioned: 0,
    totalFindings: 0,
  };

  reportData.forEach(item => {
    if (item.response && Array.isArray(item.response)) {
      item.response.forEach(platformData => {
        if (platformData.details?.websiteFound) stats.websiteFound++;
        if (platformData.details?.brandMentionFound) stats.brandMentioned++;
        if (platformData.found) stats.totalFindings++;
      });
    }
  });

  // Get unique categories
  const categories = ['All Categories', ...new Set(reportData.map(item => item.category))];

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

  // Download report as PDF
  const handleDownloadPDF = () => {
    const element = document.getElementById('report-content');
    const opt = {
      margin: 10,
      filename: `${brandData?.brandName || 'Report'}_Visibility_Analysis.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
  };

  // Share report (generate shareable link)
  const handleShareReport = async () => {
    if (!reportId) {
      alert('Report must be saved first before sharing');
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
        alert(`✅ Share link copied to clipboard!\n\n${data.shareUrl}\n\nAnyone with this link can view your report.`);
      } else {
        alert('Failed to generate share link');
      }
    } catch (error) {
      console.error('Error sharing report:', error);
      alert('Error generating share link');
    }
  };

  return (
    <div className="flex h-screen bg-gray-900">
      <Sidebar />
      
      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-6" id="report-content">
          {/* Header */}
          <div className="bg-gray-800 rounded-lg p-6 mb-6 border border-gray-700">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">
                  {brandData?.brandName || 'Brand'} - Visibility Analysis
                </h1>
                <p className="text-gray-400">
                  {brandData?.websiteUrl || 'N/A'} • {new Date().toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleDownloadPDF}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download PDF
                </button>
                <button
                  onClick={handleShareReport}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                >
                  <Share2 className="w-4 h-4" />
                  Share Report
                </button>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="text-gray-400 text-sm mb-1">Total Prompts</div>
                <div className="text-3xl font-bold text-white">{totalPrompts}</div>
              </div>
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="text-gray-400 text-sm mb-1">Website Found</div>
                <div className="text-3xl font-bold text-green-400">{stats.websiteFound}</div>
              </div>
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="text-gray-400 text-sm mb-1">Brand Mentioned</div>
                <div className="text-3xl font-bold text-blue-400">{stats.brandMentioned}</div>
              </div>
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="text-gray-400 text-sm mb-1">Total Findings</div>
                <div className="text-3xl font-bold text-purple-400">{stats.totalFindings}</div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-gray-800 rounded-lg p-4 mb-6 border border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Category Filter */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-400 mb-2">Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-primary-500 focus:outline-none"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Platform Filter */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-400 mb-2">Platform</label>
                <select
                  value={selectedPlatform}
                  onChange={(e) => setSelectedPlatform(e.target.value)}
                  className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-primary-500 focus:outline-none"
                >
                  <option value="All Platforms">All Platforms</option>
                  <option value="chatgpt">ChatGPT</option>
                  <option value="perplexity">Perplexity</option>
                  <option value="google_ai_overviews">Google AI Overview</option>
                </select>
              </div>

              {/* Search */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-400 mb-2">Search Prompts</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search..."
                    className="w-full bg-gray-700 text-white rounded-lg pl-10 pr-4 py-2 border border-gray-600 focus:border-primary-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Results Table */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-750">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Prompt
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Platform
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Found
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Index
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Website
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Citation
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {filteredData.map((item, idx) => (
                    item.response && Array.isArray(item.response) ? (
                      item.response.map((platformData, pIdx) => (
                        <tr key={`${idx}-${pIdx}`} className="hover:bg-gray-750 transition-colors">
                          {pIdx === 0 && (
                            <td className="px-6 py-4 text-sm text-gray-300" rowSpan={item.response.length}>
                              {item.prompt}
                            </td>
                          )}
                          {pIdx === 0 && (
                            <td className="px-6 py-4 text-sm text-gray-400" rowSpan={item.response.length}>
                              <span className="px-2 py-1 bg-gray-700 rounded-full text-xs">
                                {item.category}
                              </span>
                            </td>
                          )}
                          <td className="px-6 py-4 text-sm text-gray-300 capitalize">
                            {platformData.src === 'google_ai_overviews' ? 'Google AI' : platformData.src}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            {platformData.found ? (
                              <span className="px-2 py-1 bg-green-500 bg-opacity-20 text-green-400 rounded-full text-xs font-medium">
                                ✓ Yes
                              </span>
                            ) : (
                              <span className="px-2 py-1 bg-red-500 bg-opacity-20 text-red-400 rounded-full text-xs font-medium">
                                ✗ No
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-300">
                            {platformData.index !== null ? `#${platformData.index}` : '-'}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            {platformData.details?.websiteFound ? (
                              <span className="text-green-400">✓ Yes</span>
                            ) : (
                              <span className="text-gray-500">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            {platformData.details?.brandMentionFound ? (
                              <span className="text-blue-400">✓ Yes</span>
                            ) : (
                              <span className="text-gray-500">-</span>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr key={idx} className="hover:bg-gray-750">
                        <td colSpan="7" className="px-6 py-4 text-sm text-gray-500 text-center">
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
                <p className="text-gray-400">No results found</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportView;
