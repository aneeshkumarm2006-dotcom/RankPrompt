import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Trash2, Play, Pause, Globe } from 'lucide-react';
import toast from 'react-hot-toast';

const BrandScheduledReports = () => {
  const { brandId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState([]);
  const [brandData, setBrandData] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);

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

      // Fetch scheduled reports for this brand
      const schedulesRes = await fetch(`${API_URL}/analysis/scheduled-prompts?brandId=${brandId}`, {
        credentials: 'include',
      });

      if (schedulesRes.ok) {
        const { data } = await schedulesRes.json();
        setSchedules(data || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load scheduled reports');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSchedule = async (scheduleId, currentStatus) => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    try {
      const response = await fetch(`${API_URL}/analysis/scheduled-prompts/${scheduleId}/toggle`, {
        method: 'PUT',
        credentials: 'include',
      });

      if (response.ok) {
        toast.success(`Schedule ${!currentStatus ? 'activated' : 'paused'}`);
        fetchData();
      } else {
        toast.error('Failed to update schedule');
      }
    } catch (error) {
      console.error('Error toggling schedule:', error);
      toast.error('Failed to update schedule');
    }
  };

  const handleDeleteSchedule = async () => {
    if (!deleteModal) return;
    
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    try {
      const response = await fetch(`${API_URL}/analysis/scheduled-prompts/${deleteModal._id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        toast.success('Schedule deleted successfully');
        setDeleteModal(null);
        fetchData();
      } else {
        toast.error('Failed to delete schedule');
      }
    } catch (error) {
      console.error('Error deleting schedule:', error);
      toast.error('Failed to delete schedule');
    }
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    });
  };

  const getStatusBadge = (schedule) => {
    if (!schedule.isActive) {
      return <span className="text-gray-400 text-sm">⏸ Paused</span>;
    }
    if (schedule.lastRun) {
      return <span className="text-green-400 text-sm flex items-center gap-1">
        <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
        Running
      </span>;
    }
    return <span className="text-blue-400 text-sm">🕐 Scheduled</span>;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading scheduled reports...</p>
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
            Back to Brands
          </button>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white">Brand Scheduled Reports</h1>
              {brandData && (
                <p className="text-gray-400 mt-1">{brandData.brandName}</p>
              )}
              <p className="text-sm text-gray-500 mt-1">
                To create a new scheduled report, go to any report and click "Schedule Report"
              </p>
            </div>
          </div>
        </div>

        {/* Schedules List */}
        {schedules.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {schedules.map((schedule) => (
              <div
                key={schedule._id}
                className="bg-gray-800 border border-gray-700 rounded-lg p-6 hover:border-gray-600 transition-colors"
              >
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-white mb-1">
                      {schedule.brandName || brandData?.brandName || 'Report'}
                    </h3>
                    <p className="text-xs text-gray-400">{schedule._id.slice(-6)}</p>
                  </div>
                  {getStatusBadge(schedule)}
                </div>

                {/* Details */}
                <div className="space-y-3 mb-4">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Website</p>
                    <a
                      href={schedule.brandUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary-400 hover:text-primary-300 flex items-center gap-1 truncate"
                    >
                      <Globe className="w-3 h-3 flex-shrink-0" />
                      {schedule.brandUrl}
                    </a>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Next Run</p>
                      <p className="text-sm text-white font-medium">
                        {formatDate(schedule.nextRun)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Created</p>
                      <p className="text-sm text-white font-medium">
                        {formatDate(schedule.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-gray-400 mb-1">Frequency</p>
                    <span className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs capitalize">
                      {schedule.scheduleFrequency}
                    </span>
                  </div>

                  <div>
                    <p className="text-xs text-gray-400 mb-1">AI Models</p>
                    <div className="flex flex-wrap gap-1">
                      {schedule.aiModels?.map((model, idx) => (
                        <span key={idx} className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs capitalize">
                          {model === 'chatgpt' ? 'GPT' : model === 'perplexity' ? 'PPX' : model === 'google_ai_overview' ? 'AIO' : model}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t border-gray-700">
                  <button
                    onClick={() => handleToggleSchedule(schedule._id, schedule.isActive)}
                    className={`flex-1 px-3 py-2 rounded transition-colors text-sm font-medium ${
                      schedule.isActive
                        ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                        : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                    }`}
                  >
                    {schedule.isActive ? (
                      <>
                        <Pause className="w-4 h-4 inline mr-1" /> Pause
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 inline mr-1" /> Resume
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setDeleteModal(schedule)}
                    className="px-3 py-2 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors text-sm font-medium"
                  >
                    <Trash2 className="w-4 h-4 inline mr-1" /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-12 text-center">
            <Calendar className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">No Scheduled Reports</h3>
            <p className="text-gray-400 mb-4">
              You haven't scheduled any reports for this brand yet.
            </p>
            <p className="text-sm text-gray-500">
              To schedule a report: Go to <span className="text-primary-400">All Reports</span> → 
              View any report → Click <span className="text-primary-400">"Schedule Report"</span> button
            </p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-white mb-4">Delete Scheduled Report?</h3>
            <p className="text-gray-400 mb-6">
              Are you sure you want to delete this scheduled report? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteModal(null)}
                className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSchedule}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BrandScheduledReports;
