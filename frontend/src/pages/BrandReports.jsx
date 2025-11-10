import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, Calendar, Globe, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';

const BrandReports = () => {
  const { brandId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState([]);
  const [brandData, setBrandData] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState('All Categories');
  const [dateFilter, setDateFilter] = useState('Last 30 days');

  useEffect(() => {
    fetchData();
  }, [brandId]);

  const fetchData = async () => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    try {
      setLoading(true);

      // Fetch brand data
      const brandRes = await fetch(`${API_URL}/brand/${brandId}`, {
        credentials: 'include',
      });
      if (brandRes.ok) {
        const { data } = await brandRes.json();
        setBrandData(data);
      }

      // Fetch all reports for the brand
      const reportsRes = await fetch(`${API_URL}/reports/brand/${brandId}`, {
        credentials: 'include',
      });

      if (reportsRes.ok) {
        const { data } = await reportsRes.json();
        setReports(data || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  // Get unique categories from all reports
  const allCategories = ['All Categories'];
  reports.forEach(report => {
    if (report.reportData) {
      report.reportData.forEach(item => {
        if (item.category && !allCategories.includes(item.category)) {
          allCategories.push(item.category);
        }
      });
    }
  });

  // Filter reports based on selected filters
  const filteredReports = reports.filter(report => {
    // Date filter
    if (dateFilter !== 'All time') {
      const reportDate = new Date(report.reportDate || report.createdAt);
      const now = new Date();
      const daysDiff = Math.floor((now - reportDate) / (1000 * 60 * 60 * 24));
      
      if (dateFilter === 'Last 7 days' && daysDiff > 7) return false;
      if (dateFilter === 'Last 30 days' && daysDiff > 30) return false;
      if (dateFilter === 'Last 90 days' && daysDiff > 90) return false;
    }
    
    // Category filter
    if (selectedFilter !== 'All Categories') {
      if (!report.reportData) return false;
      const hasCategory = report.reportData.some(item => item.category === selectedFilter);
      if (!hasCategory) return false;
    }
    
    return true;
  });

  // Determine if a report is static (first/oldest) or scheduled
  const getReportType = (reportDate) => {
    if (reports.length === 0) return 'Static';
    const sortedReports = [...reports].sort((a, b) => 
      new Date(a.createdAt) - new Date(b.createdAt)
    );
    const firstReport = sortedReports[0];
    return new Date(firstReport.createdAt).getTime() === new Date(reportDate).getTime() 
      ? 'Static' 
      : 'Scheduled';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-primary-400 hover:text-primary-300 mb-4 text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Overview
          </button>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white">All Reports</h1>
              {brandData && (
                <p className="text-gray-400 mt-1">{brandData.brandName}</p>
              )}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-gray-800 rounded-lg p-4 sm:p-6 mb-6 border border-gray-700">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-400 mb-2">
                Report Type
              </label>
              <select
                value={selectedFilter}
                onChange={(e) => setSelectedFilter(e.target.value)}
                className="w-full bg-gray-700 text-white rounded-lg px-3 sm:px-4 py-2 border border-gray-600 focus:border-primary-500 focus:outline-none text-sm sm:text-base"
              >
                {allCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-400 mb-2">
                Date Range
              </label>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full bg-gray-700 text-white rounded-lg px-3 sm:px-4 py-2 border border-gray-600 focus:border-primary-500 focus:outline-none text-sm sm:text-base"
              >
                <option>Last 7 days</option>
                <option>Last 30 days</option>
                <option>Last 90 days</option>
                <option>All time</option>
              </select>
            </div>
          </div>
        </div>

        {/* Reports Table */}
        <div className="bg-gray-800 rounded-lg border border-gray-700">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-750">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Website
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Search Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Language
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Categories
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Prompts
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {filteredReports.length > 0 ? (
                  filteredReports.map((report) => {
                    const reportType = getReportType(report.createdAt);
                    const categoriesCount = report.reportData 
                      ? [...new Set(report.reportData.map(item => item.category))].length 
                      : 0;
                    const promptsCount = report.reportData ? report.reportData.length : 0;

                    return (
                      <tr key={report._id} className="hover:bg-gray-750 transition-colors">
                        <td className="px-4 py-3 text-sm text-gray-400 whitespace-nowrap">
                          {new Date(report.reportDate || report.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            report.status === 'completed'
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {report.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300 max-w-xs truncate">
                          <a 
                            href={report.brandUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary-400 hover:text-primary-300"
                          >
                            {report.brandUrl}
                          </a>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300 whitespace-nowrap">
                          {report.location || 'Global'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300 whitespace-nowrap">
                          <span className="px-2 py-1 bg-gray-700 rounded text-xs capitalize">
                            {report.searchScope || 'global'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300 whitespace-nowrap">
                          {report.language || 'English'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300 whitespace-nowrap">
                          {categoriesCount}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300 whitespace-nowrap">
                          {promptsCount}
                        </td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                          <button
                            onClick={() => navigate(`/reports/${report._id}`)}
                            className="px-3 py-1.5 bg-primary-500 text-white rounded hover:bg-primary-600 transition-colors flex items-center gap-1"
                          >
                            <Eye className="w-4 h-4" />
                            View Report
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="9" className="px-4 py-8 text-center text-gray-400">
                      No reports found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Stats Summary */}
        {filteredReports.length > 0 && (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                <Calendar className="w-4 h-4" />
                Total Reports
              </div>
              <div className="text-2xl font-bold text-white">{filteredReports.length}</div>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                <Globe className="w-4 h-4" />
                Static Reports
              </div>
              <div className="text-2xl font-bold text-white">
                {filteredReports.filter(r => getReportType(r.createdAt) === 'Static').length}
              </div>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                <Calendar className="w-4 h-4" />
                Scheduled Reports
              </div>
              <div className="text-2xl font-bold text-white">
                {filteredReports.filter(r => getReportType(r.createdAt) === 'Scheduled').length}
              </div>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                <MapPin className="w-4 h-4" />
                Total Prompts
              </div>
              <div className="text-2xl font-bold text-white">
                {filteredReports.reduce((sum, r) => sum + (r.reportData ? r.reportData.length : 0), 0)}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BrandReports;
