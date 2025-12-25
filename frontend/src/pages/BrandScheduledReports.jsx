import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Trash2, Play, Pause, Globe, Pencil, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

const BrandScheduledReports = () => {
  const { brandId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState([]);
  const [brandData, setBrandData] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);
  const [editModal, setEditModal] = useState(null);
  const [promptInputs, setPromptInputs] = useState([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleFrequency, setScheduleFrequency] = useState('weekly');
  const [scheduling, setScheduling] = useState(false);
  const [latestReportId, setLatestReportId] = useState(null);

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

      // Fetch latest report for this brand (needed to schedule)
      const reportsRes = await fetch(`${API_URL}/reports/brand/${brandId}`, {
        credentials: 'include',
      });

      if (reportsRes.ok) {
        const { data: reportsData } = await reportsRes.json();
        if (Array.isArray(reportsData) && reportsData.length > 0) {
          const latest = [...reportsData].sort(
            (a, b) => new Date(b.createdAt || b.reportDate) - new Date(a.createdAt || a.reportDate)
          )[0];
          setLatestReportId(latest?._id || null);
        } else {
          setLatestReportId(null);
        }
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

  const openEditModal = (schedule) => {
    setEditModal(schedule);
    setPromptInputs(
      schedule?.prompts?.length
        ? schedule.prompts.map(p => p.prompt || '')
        : ['']
    );
  };

  const handlePromptChange = (index, value) => {
    setPromptInputs(prev => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  };

  const handleAddPrompt = () => {
    setPromptInputs(prev => [...prev, '']);
  };

  const handleRemovePrompt = (index) => {
    setPromptInputs(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleSchedule = async () => {
    if (!latestReportId) {
      toast.error('No report available to schedule');
      return;
    }

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    try {
      setScheduling(true);
      const resp = await fetch(`${API_URL}/analysis/schedule-from-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reportId: latestReportId, frequency: scheduleFrequency }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to schedule report');
      }

      setShowScheduleModal(false);
      toast.success('Report scheduled successfully');
      fetchData();
    } catch (error) {
      console.error('Error scheduling report:', error);
      toast.error(error.message || 'Failed to schedule report');
    } finally {
      setScheduling(false);
    }
  };

  const handleSavePrompts = async () => {
    if (!editModal) return;
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

    const cleaned = promptInputs.map(p => p.trim()).filter(Boolean);
    if (!cleaned.length) {
      toast.error('Please add at least one prompt');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/analysis/scheduled-prompts/${editModal._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ prompts: cleaned }),
      });

      if (response.ok) {
        toast.success('Prompts updated');
        setEditModal(null);
        fetchData();
      } else {
        const err = await response.json().catch(() => ({}));
        toast.error(err.message || 'Failed to update prompts');
      }
    } catch (error) {
      console.error('Error updating prompts:', error);
      toast.error('Failed to update prompts');
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
      <div className="flex items-center justify-center py-20 bg-gray-50 dark:bg-dark-950 min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-gray-400 dark:text-gray-500">Loading scheduled reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-[#F8FAFC] dark:bg-dark-950">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white">Scheduled Reports</h1>
            {brandData && (
              <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm sm:text-base">{brandData.brandName}</p>
            )}
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-2">
              To create a new scheduled report, use the button below.
            </p>
          </div>
          {/* {schedules.length === 0 && (
            <button
              onClick={() => setShowScheduleModal(true)}
              disabled={!latestReportId}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm sm:text-base whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Calendar className="w-4 h-4" />
              Schedule Report123
            </button>
          )} */}
        </div>

        {/* Schedules List */}
        {schedules.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {schedules.map((schedule) => (
              <div
                key={schedule._id}
                className="bg-white dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-lg p-6 hover:border-gray-300 dark:hover:border-dark-600 transition-colors"
              >
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-1">
                      {schedule.brandName || brandData?.brandName || 'Report'}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{schedule._id.slice(-6)}</p>
                  </div>
                  {getStatusBadge(schedule)}
                </div>

                {/* Details */}
                <div className="space-y-3 mb-4">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Website</p>
                    <a
                      href={schedule.brandUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary-400 hover:text-primary-300 dark:text-primary-500 dark:hover:text-primary-400 flex items-center gap-1 truncate"
                    >
                      <Globe className="w-3 h-3 flex-shrink-0" />
                      {schedule.brandUrl}
                    </a>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Next Run</p>
                      <p className="text-sm text-gray-800 dark:text-gray-200 font-medium">
                        {formatDate(schedule.nextRun)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Created</p>
                      <p className="text-sm text-gray-800 dark:text-gray-200 font-medium">
                        {formatDate(schedule.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Frequency</p>
                    <span className="px-2 py-1 bg-gray-200 dark:bg-dark-700 text-gray-700 dark:text-gray-300 rounded text-xs capitalize">
                      {schedule.scheduleFrequency}
                    </span>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">AI Models</p>
                    <div className="flex flex-wrap gap-1">
                      {schedule.aiModels?.map((model, idx) => (
                        <span key={idx} className="px-2 py-1 bg-gray-200 dark:bg-dark-700 text-gray-700 dark:text-gray-300 rounded text-xs capitalize">
                          {model === 'chatgpt' ? 'GPT' : model === 'perplexity' ? 'PPX' : model === 'google_ai_overview' ? 'AIO' : model}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-dark-700">
                  <button
                    onClick={() => openEditModal(schedule)}
                    className="flex-1 px-3 py-2 bg-blue-500/20 text-blue-500 rounded hover:bg-blue-500/30 transition-colors text-sm font-medium"
                  >
                    <Pencil className="w-4 h-4 inline mr-1" /> Edit Prompts
                  </button>
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
          <div className="bg-white dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-lg p-12 text-center">
            <Calendar className="w-16 h-16 text-gray-600 dark:text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">No Scheduled Reports</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              You haven't scheduled any reports for this brand yet.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              You can schedule one now for the latest report.
            </p>
            <button
              onClick={() => setShowScheduleModal(true)}
              disabled={!latestReportId}
              className="mt-4 inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm sm:text-base whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Calendar className="w-4 h-4" />
              Schedule Report
            </button>
          </div>
        )}
      </div>

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-lg p-4 sm:p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Schedule this report</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Frequency</label>
                <select
                  value={scheduleFrequency}
                  onChange={(e) => setScheduleFrequency(e.target.value)}
                  className="w-full bg-gray-100 dark:bg-dark-800 text-gray-800 dark:text-gray-200 rounded-lg px-3 py-2 border border-gray-300 dark:border-dark-600 focus:border-primary-500 focus:outline-none"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div className="flex justify-end gap-4">
                <button
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 bg-gray-200 dark:bg-dark-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-dark-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSchedule}
                  disabled={scheduling}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed"
                >
                  {scheduling ? 'Scheduling...' : 'Schedule Now'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Delete Scheduled Report?</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete this scheduled report? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteModal(null)}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-dark-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-dark-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSchedule}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Prompts Modal */}
      {editModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-lg p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-800 dark:text-white">Edit Scheduled Prompts</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Update the prompts that will be used for future runs of this schedule.
                </p>
              </div>
              <button
                onClick={() => setEditModal(null)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {promptInputs.map((prompt, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Prompt {idx + 1}</label>
                    <textarea
                      value={prompt}
                      onChange={(e) => handlePromptChange(idx, e.target.value)}
                      rows={2}
                      className="w-full bg-gray-100 dark:bg-dark-800 text-gray-800 dark:text-gray-200 rounded-lg px-3 py-2 border border-gray-300 dark:border-dark-600 focus:border-primary-500 focus:outline-none"
                      placeholder="Enter prompt text"
                    />
                  </div>
                  <button
                    onClick={() => handleRemovePrompt(idx)}
                    className="mt-7 px-2 py-1 text-xs text-white  hover:text-red-700 dark:hover:text-red-400"
                    disabled={promptInputs.length <= 1}
                  >
                    Remove
                  </button>
                </div>
              ))}

              <button
                onClick={handleAddPrompt}
                className="flex items-center gap-2 text-sm text-primary-500 hover:text-primary-400 dark:text-primary-400 dark:hover:text-primary-300"
              >
                <Plus className="w-4 h-4" /> Add prompt
              </button>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setEditModal(null)}
                className="px-4 py-2 bg-gray-200 dark:bg-dark-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-dark-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePrompts}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:bg-action-600 dark:hover:bg-action-700 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BrandScheduledReports;
