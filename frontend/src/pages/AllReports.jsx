import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { Eye, Trash2, Share2, Calendar, TrendingUp, PlayCircle, Clock } from 'lucide-react';

const AllReports = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [inProgressReports, setInProgressReports] = useState([]);
  const [completedReports, setCompletedReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchReports();
  }, [currentPage]);

  const fetchReports = async () => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    try {
      const response = await fetch(`${API_URL}/reports/list?page=${currentPage}&limit=20`, {
        credentials: 'include',
      });

      if (response.ok) {
        const { data, totalPages: total } = await response.json();
        setReports(data);
        
        // Separate in-progress and completed reports
        const inProgress = data.filter(r => r.status === 'in-progress');
        const completed = data.filter(r => r.status === 'completed');
        
        setInProgressReports(inProgress);
        setCompletedReports(completed);
        setTotalPages(total);
      } else {
        console.error('Failed to fetch reports');
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteReport = async (reportId) => {
    if (!confirm('Are you sure you want to delete this report?')) return;

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    try {
      const response = await fetch(`${API_URL}/reports/${reportId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        // Update state immediately to remove from UI
        setReports(prevReports => prevReports.filter(r => r._id !== reportId));
        setInProgressReports(prev => prev.filter(r => r._id !== reportId));
        setCompletedReports(prev => prev.filter(r => r._id !== reportId));
        alert('Report deleted successfully');
      } else {
        alert('Failed to delete report');
      }
    } catch (error) {
      console.error('Error deleting report:', error);
      alert('Error deleting report');
    }
  };

  const handleShareReport = async (reportId) => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    try {
      const response = await fetch(`${API_URL}/reports/${reportId}/share`, {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        const { data } = await response.json();
        navigator.clipboard.writeText(data.shareUrl);
        alert(`✅ Share link copied!\n\n${data.shareUrl}`);
      } else {
        alert('Failed to generate share link');
      }
    } catch (error) {
      console.error('Error sharing report:', error);
      alert('Error generating share link');
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-900">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading reports...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-900">
      <Sidebar />
      
      <div className="flex-1 ml-64 overflow-auto">
        <div className="max-w-7xl mx-auto p-6">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-white mb-2">All Reports</h1>
            <p className="text-gray-400">View and manage your visibility reports</p>
          </div>

          {reports.length === 0 ? (
            <div className="bg-gray-800 rounded-lg p-12 text-center border border-gray-700">
              <TrendingUp className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">No Reports Yet</h2>
              <p className="text-gray-400 mb-6">Create your first visibility report to get started</p>
              <button
                onClick={() => navigate('/reports/new')}
                className="px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
              >
                Create New Report
              </button>
            </div>
          ) : (
            <>
              {/* In-Progress Reports Section */}
              {inProgressReports.length > 0 && (
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <Clock className="w-5 h-5 text-yellow-500" />
                    <h2 className="text-xl font-bold text-white">In Progress</h2>
                    <span className="text-sm text-gray-400">({inProgressReports.length})</span>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    {inProgressReports.map((report) => (
                      <div
                        key={report._id}
                        className="bg-gray-800 rounded-lg p-6 border-2 border-yellow-500/30 hover:border-yellow-500/50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          {/* Left: Brand Info */}
                          <div className="flex items-start gap-4 flex-1">
                            {report.favicon && (
                              <img
                                src={report.favicon}
                                alt={report.brandName}
                                className="w-12 h-12 rounded-lg"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                              />
                            )}
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-xl font-bold text-white">
                                  {report.brandName}
                                </h3>
                                <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">
                                  Step {report.progress?.currentStep || 1} of 3
                                </span>
                              </div>
                              <p className="text-gray-400 text-sm mb-3">{report.brandUrl}</p>
                              
                              {/* Meta */}
                              <div className="flex items-center gap-2 text-sm text-gray-500">
                                <Calendar className="w-4 h-4" />
                                <span>Last updated: {new Date(report.progress?.lastUpdated || report.updatedAt).toLocaleDateString()}</span>
                                <span className="mx-2">•</span>
                                <span className="capitalize">{report.searchScope} Search</span>
                              </div>
                            </div>
                          </div>

                          {/* Right: Actions */}
                          <div className="flex items-center gap-2 ml-4">
                            <button
                              onClick={() => navigate(`/reports/new?continue=${report._id}`)}
                              className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
                              title="Continue Report"
                            >
                              <PlayCircle className="w-4 h-4" />
                              Continue
                            </button>
                            <button
                              onClick={() => handleDeleteReport(report._id)}
                              className="flex items-center gap-2 px-4 py-2 bg-red-500 bg-opacity-20 text-red-400 rounded-lg hover:bg-opacity-30 transition-colors"
                              title="Delete Report"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Completed Reports Section */}
              {completedReports.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-5 h-5 text-green-500" />
                    <h2 className="text-xl font-bold text-white">Completed Reports</h2>
                    <span className="text-sm text-gray-400">({completedReports.length})</span>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    {completedReports.map((report) => (
                  <div
                    key={report._id}
                    className="bg-gray-800 rounded-lg p-6 border border-gray-700 hover:border-gray-600 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      {/* Left: Brand Info */}
                      <div className="flex items-start gap-4 flex-1">
                        {report.favicon && (
                          <img
                            src={report.favicon}
                            alt={report.brandName}
                            className="w-12 h-12 rounded-lg"
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        )}
                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-white mb-1">
                            {report.brandName}
                          </h3>
                          <p className="text-gray-400 text-sm mb-3">{report.brandUrl}</p>
                          
                          {/* Stats */}
                          <div className="flex flex-wrap gap-4 mb-3">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500 text-sm">Prompts:</span>
                              <span className="text-white font-semibold">{report.stats?.totalPrompts || 0}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500 text-sm">Website Found:</span>
                              <span className="text-green-400 font-semibold">{report.stats?.websiteFound || 0}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500 text-sm">Brand Mentioned:</span>
                              <span className="text-blue-400 font-semibold">{report.stats?.brandMentioned || 0}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500 text-sm">Success Rate:</span>
                              <span className="text-purple-400 font-semibold">{report.stats?.successRate || 0}%</span>
                            </div>
                          </div>

                          {/* Meta */}
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Calendar className="w-4 h-4" />
                            <span>{new Date(report.reportDate || report.createdAt).toLocaleDateString()}</span>
                            <span className="mx-2">•</span>
                            <span className="capitalize">{report.searchScope} Search</span>
                            {report.location && (
                              <>
                                <span className="mx-2">•</span>
                                <span>{report.location}, {report.country}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => navigate(`/reports/${report._id}`)}
                          className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                          title="View Report"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </button>
                        <button
                          onClick={() => handleShareReport(report._id)}
                          className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 hover:text-white transition-colors"
                          title="Share Report"
                        >
                          <Share2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteReport(report._id)}
                          className="flex items-center gap-2 px-4 py-2 bg-red-500 bg-opacity-20 text-red-400 rounded-lg hover:bg-opacity-30 transition-colors"
                          title="Delete Report"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-6">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>
                  <span className="px-4 py-2 bg-gray-800 text-white rounded-lg">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AllReports;
