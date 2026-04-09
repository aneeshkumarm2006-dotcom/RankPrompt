import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Sidebar from '../components/Sidebar';
import { getAuthHeaders } from '../services/api';
import { Eye, Share2, Calendar, TrendingUp, PlayCircle, Clock, Trash2, X } from 'lucide-react';

const AllReports = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [inProgressReports, setInProgressReports] = useState([]);
  const [completedReports, setCompletedReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showAuditPromoPopup, setShowAuditPromoPopup] = useState(false);

  useEffect(() => {
    fetchReports();
  }, [currentPage]);

  useEffect(() => {
    if (loading) return;

    const hasShownPopup = sessionStorage.getItem('auditPopupShown');
    if (hasShownPopup) return;

    const popupTimer = setTimeout(() => {
      setShowAuditPromoPopup(true);
      sessionStorage.setItem('auditPopupShown', 'true');
    }, 1500);

    return () => clearTimeout(popupTimer);
  }, [loading]);

  const handleCloseAuditPromoPopup = () => {
    setShowAuditPromoPopup(false);
  };

  const fetchReports = async () => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    try {
      const response = await fetch(`${API_URL}/reports/list?page=${currentPage}&limit=20`, {
        headers: getAuthHeaders(),
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

  const handleDeleteInProgressReport = async (reportId) => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    
    if (!confirm('Are you sure you want to delete this in-progress report?')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/reports/${reportId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      if (response.ok) {
        toast.success('Report deleted successfully');
        // Refresh the reports list
        fetchReports();
      } else {
        toast.error('Failed to delete report');
      }
    } catch (error) {
      console.error('Error deleting report:', error);
      toast.error('Error deleting report');
    }
  };

  const handleShareReport = async (reportId) => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    try {
      const response = await fetch(`${API_URL}/reports/${reportId}/share`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      if (response.ok) {
        const { data } = await response.json();
        navigator.clipboard.writeText(data.shareUrl);
        toast.success('Share link copied to clipboard!', {
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

  if (loading) {
    return (
      <div className="flex h-screen bg-[#F8FAFC] dark:bg-dark-950">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading reports...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] dark:bg-dark-950">
      <Sidebar />

      <div className="flex-1 lg:ml-64 overflow-auto">
        <div className="max-w-7xl mx-auto p-4 sm:p-6 mt-16 lg:mt-0">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white mb-2">All Reports</h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">View and manage your visibility reports</p>
          </div>

          {reports.length === 0 ? (
            <div className="bg-white dark:bg-dark-900 rounded-lg p-8 sm:p-12 text-center border border-gray-200 dark:border-dark-700">
              <TrendingUp className="w-16 h-16 text-gray-600 dark:text-gray-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">No Reports Yet</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">Create your first visibility report to get started</p>
              <button
                onClick={() => navigate('/reports/new')}
                className="px-6 py-3 bg-action-500 text-white rounded-lg hover:bg-action-600 transition-colors"
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
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white">In Progress</h2>
                    <span className="text-sm text-gray-600 dark:text-gray-400">({inProgressReports.length})</span>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    {inProgressReports.map((report) => (
                      <div
                        key={report._id}
                        className="bg-white dark:bg-dark-900 rounded-lg p-4 sm:p-6 border-2 border-yellow-500/30 dark:border-yellow-500/50 hover:border-yellow-500/50 dark:hover:border-yellow-500/70 transition-colors"
                      >
                        <div className="flex flex-col lg:flex-row items-start justify-between gap-4">
                          {/* Left: Brand Info */}
                          <div className="flex items-start gap-3 sm:gap-4 flex-1">
                            {report.favicon && (
                              <img
                                src={report.favicon}
                                alt={report.brandName}
                                className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex-shrink-0"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1">
                                <h3 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white break-words">
                                  {report.brandName}
                                </h3>
                                <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">
                                  Step {report.progress?.currentStep || 1} of 3
                                </span>
                              </div>
                              <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm mb-3 break-all">{report.brandUrl}</p>

                              {/* Meta */}
                              <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                                <Calendar className="w-4 h-4" />
                                <span>Last updated: {new Date(report.progress?.lastUpdated || report.updatedAt).toLocaleDateString()}</span>
                                <span className="mx-2">•</span>
                                <span className="capitalize">{report.searchScope} Search</span>
                              </div>
                            </div>
                          </div>

                          {/* Right: Actions */}
                          <div className="flex items-center gap-2 w-full lg:w-auto lg:ml-4">
                            <button
                              onClick={() => navigate(`/reports/new?continue=${report._id}`)}
                              className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-yellow-500 dark:bg-yellow-600 text-gray-800 dark:text-white rounded-lg hover:bg-yellow-600 dark:hover:bg-yellow-700 transition-colors text-sm flex-1 lg:flex-initial"
                              title="Continue Report"
                            >
                              <PlayCircle className="w-4 h-4" />
                              <span className="hidden sm:inline">Continue</span>
                            </button>
                            <button
                              onClick={() => handleDeleteInProgressReport(report._id)}
                              className="flex items-center justify-center gap-2 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors text-sm"
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
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white">Completed Reports</h2>
                    <span className="text-sm text-gray-600 dark:text-gray-400">({completedReports.length})</span>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    {completedReports.map((report) => (
                      <div
                        key={report._id}
                        className="bg-white dark:bg-dark-900 rounded-lg p-4 sm:p-6 border border-gray-200 dark:border-dark-700 hover:border-gray-300 dark:hover:border-dark-600 transition-colors"
                      >
                        <div className="flex flex-col lg:flex-row items-start justify-between gap-4">
                          {/* Left: Brand Info */}
                          <div className="flex items-start gap-3 sm:gap-4 flex-1">
                            {report.favicon && (
                              <img
                                src={report.favicon}
                                alt={report.brandName}
                                className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex-shrink-0"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <h3 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white mb-1 break-words">
                                {report.brandName}
                              </h3>
                              <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm mb-3 break-all">{report.brandUrl}</p>

                              {/* Stats */}
                              <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-3 sm:gap-4 mb-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm">Prompts:</span>
                                  <span className="text-gray-800 dark:text-white font-semibold">{report.stats?.totalPrompts || 0}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-500 dark:text-gray-400 text-sm">Website Found:</span>
                                  <span className="text-green-400 font-semibold">{report.stats?.websiteFound || 0}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-500 dark:text-gray-400 text-sm">Brand Mentioned:</span>
                                  <span className="text-blue-400 font-semibold">{report.stats?.brandMentioned || 0}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-500 dark:text-gray-400 text-sm">Success Rate:</span>
                                  <span className="text-purple-400 font-semibold">{report.stats?.successRate || 0}%</span>
                                </div>
                              </div>

                              {/* Meta */}
                              <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
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
                          <div className="flex items-center gap-2 w-full lg:w-auto lg:ml-4">
                            <button
                              onClick={() => navigate(`/reports/${report._id}`)}
                              className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-action-500 text-white rounded-lg hover:bg-action-600 transition-colors text-sm flex-1 lg:flex-initial"
                              title="View Report"
                            >
                              <Eye className="w-4 h-4" />
                              <span className="hidden sm:inline">View</span>
                            </button>
                            <button
                              onClick={() => handleShareReport(report._id)}
                              className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-white dark:bg-dark-800 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
                              title="Share Report"
                            >
                              <Share2 className="w-4 h-4" />
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
                <div className="flex flex-col sm:flex-row justify-center items-center gap-2 sm:gap-2 mt-6">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 bg-white dark:bg-dark-800 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>
                  <span className="px-4 py-2 bg-white dark:bg-dark-800 text-gray-800 dark:text-gray-200 rounded-lg">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 bg-white dark:bg-dark-800 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showAuditPromoPopup && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4 animate-fade-in"
          style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleCloseAuditPromoPopup();
            }
          }}
        >
          <div
            className="relative rounded-2xl shadow-2xl w-full max-w-[580px] animate-slide-up overflow-hidden"
            style={{ background: '#ffffff', border: '1px solid #e2e8f0' }}
          >
            {/* Close button */}
            <button
              onClick={handleCloseAuditPromoPopup}
              className="absolute top-4 right-4 z-10 transition-colors"
              style={{ color: '#94a3b8' }}
              onMouseEnter={e => e.currentTarget.style.color = '#475569'}
              onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
              aria-label="Close promotional popup"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Card content */}
            <div className="px-8 pt-10 pb-10 sm:px-10 sm:pt-12 sm:pb-12">
              {/* Davnoot logo PNG */}
              <div className="mb-6">
                <img
                  src="/davnoot-logo.png"
                  alt="Davnoot Digital"
                  style={{ height: '32px', width: 'auto', objectFit: 'contain' }}
                />
              </div>

              {/* Headline */}
              <h2
                className="leading-tight pr-8"
                style={{
                  fontSize: 'clamp(1.25rem, 4vw, 1.6rem)',
                  fontWeight: 800,
                  color: '#0f172a',
                  textTransform: 'uppercase',
                  fontFamily: 'Inter, sans-serif',
                  letterSpacing: '-0.01em',
                  lineHeight: 1.18,
                }}
              >
                Want to improve your visibility across all AI answer engines?
              </h2>

              {/* Divider */}
              <div style={{ height: '1px', background: '#e2e8f0', margin: '28px 0' }} />

              {/* Body */}
              <p
                className="leading-relaxed"
                style={{ color: '#475569', fontSize: '1rem' }}
              >
                Book a free strategy call with David Cummings at Davnoot Digital he'll walk you through exactly how to rank where AI searches.
              </p>

              <div className="mt-10 flex flex-col gap-3">
                <a
                  href="mailto:info@davnoot.com"
                  onClick={handleCloseAuditPromoPopup}
                  className="w-full inline-flex items-center justify-center px-4 py-3.5 rounded-xl font-bold transition-all duration-200"
                  style={{
                    background: 'linear-gradient(to right, #3b82f6 0%, #6366f1 100%)',
                    color: '#ffffff',
                    boxShadow: '0 4px 18px rgba(59,130,246,0.25)',
                    fontSize: '1rem',
                  }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = '0 6px 26px rgba(59,130,246,0.45), 0 4px 12px rgba(99,102,241,0.3)'}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = '0 4px 18px rgba(59,130,246,0.25)'}
                >
                  Book a Free Call
                </a>
                <button
                  onClick={handleCloseAuditPromoPopup}
                  className="w-full text-center text-sm transition-colors"
                  style={{ color: '#94a3b8' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#475569'}
                  onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
                >
                  Maybe later
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AllReports;
