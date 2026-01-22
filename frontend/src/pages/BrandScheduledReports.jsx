import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Calendar,
  Trash2,
  Play,
  Pause,
  Globe,
  Pencil,
  Search,
  ChevronDown,
  AlertCircle,
  Clock,
  Zap,
  X,
  Check,
} from 'lucide-react';
import { getAuthHeaders } from '../services/api';
import toast from 'react-hot-toast';

// AI Model config
const MODEL_CONFIG = {
  chatgpt: {
    id: 'chatgpt',
    name: 'ChatGPT',
    shortName: 'GPT',
    color: 'text-green-500',
    bgColor: 'bg-green-500/20',
  },
  perplexity: {
    id: 'perplexity',
    name: 'Perplexity',
    shortName: 'PPX',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/20',
  },
  google_ai_overview: {
    id: 'google_ai_overview',
    name: 'Google AI Overview',
    shortName: 'AIO',
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/20',
  },
};

const CREDIT_COST_PER_PROMPT_PER_MODEL = 1;

const BrandScheduledReports = () => {
  const { brandId } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState([]);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [brandData, setBrandData] = useState(null);
  const [userCredits, setUserCredits] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [latestReportId, setLatestReportId] = useState(null);
  
  // Modals
  const [deleteModal, setDeleteModal] = useState(false);
  const [editPromptModal, setEditPromptModal] = useState(null);
  const [editModelsModal, setEditModelsModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [frequencyDropdown, setFrequencyDropdown] = useState(false);
  const [scheduleSelector, setScheduleSelector] = useState(false);
  
  // Form states
  const [editPromptValue, setEditPromptValue] = useState('');
  const [selectedModels, setSelectedModels] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [scheduleFrequency, setScheduleFrequency] = useState('weekly');

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  useEffect(() => {
    fetchData();
  }, [brandId]);

  // Auto-select first schedule when schedules change
  useEffect(() => {
    if (schedules.length > 0 && !selectedSchedule) {
      setSelectedSchedule(schedules[0]);
      setSelectedModels(schedules[0].aiModels || []);
    }
  }, [schedules]);

  const fetchData = async () => {
    try {
      setLoading(true);

      const [brandRes, schedulesRes, userRes, reportsRes] = await Promise.all([
        fetch(`${API_URL}/brand/${brandId}`, {
          headers: getAuthHeaders(),
          credentials: 'include',
        }),
        fetch(`${API_URL}/analysis/scheduled-prompts?brandId=${brandId}`, {
          headers: getAuthHeaders(),
          credentials: 'include',
        }),
        fetch(`${API_URL}/auth/me`, {
          headers: getAuthHeaders(),
          credentials: 'include',
        }),
        fetch(`${API_URL}/reports/brand/${brandId}`, {
          headers: getAuthHeaders(),
          credentials: 'include',
        }),
      ]);

      if (brandRes.ok) {
        const { data } = await brandRes.json();
        setBrandData(data);
      }

      if (schedulesRes.ok) {
        const { data } = await schedulesRes.json();
        setSchedules(data || []);
        // Update selected schedule if it exists
        if (selectedSchedule) {
          const updated = data?.find(s => s._id === selectedSchedule._id);
          if (updated) {
            setSelectedSchedule(updated);
            setSelectedModels(updated.aiModels || []);
          }
        }
      }

      if (userRes.ok) {
        const { user } = await userRes.json();
        setUserCredits(user?.credits || 0);
      }

      if (reportsRes.ok) {
        const { data: reportsData } = await reportsRes.json();
        if (Array.isArray(reportsData) && reportsData.length > 0) {
          const latest = [...reportsData].sort(
            (a, b) => new Date(b.createdAt || b.reportDate) - new Date(a.createdAt || a.reportDate)
          )[0];
          setLatestReportId(latest?._id || null);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load scheduled reports');
    } finally {
      setLoading(false);
    }
  };

  // Calculate credits needed for next run
  const creditsNeeded = useMemo(() => {
    if (!selectedSchedule) return 0;
    const promptCount = selectedSchedule.prompts?.length || 0;
    const modelCount = selectedSchedule.aiModels?.length || 0;
    return promptCount * modelCount * CREDIT_COST_PER_PROMPT_PER_MODEL;
  }, [selectedSchedule]);

  const hasEnoughCredits = userCredits >= creditsNeeded;

  // Filter prompts based on search
  const filteredPrompts = useMemo(() => {
    if (!selectedSchedule?.prompts) return [];
    if (!searchQuery.trim()) return selectedSchedule.prompts;
    
    const query = searchQuery.toLowerCase();
    return selectedSchedule.prompts.filter(
      (p) =>
        p.prompt?.toLowerCase().includes(query) ||
        p.category?.toLowerCase().includes(query)
    );
  }, [selectedSchedule?.prompts, searchQuery]);

  // Get unique categories
  const categories = useMemo(() => {
    if (!selectedSchedule?.prompts) return [];
    const cats = new Set(selectedSchedule.prompts.map((p) => p.category).filter(Boolean));
    return Array.from(cats);
  }, [selectedSchedule?.prompts]);

  const handleToggleSchedule = async () => {
    if (!selectedSchedule) return;
    try {
      setActionLoading(true);
      const response = await fetch(`${API_URL}/analysis/scheduled-prompts/${selectedSchedule._id}/toggle`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      if (response.ok) {
        toast.success(selectedSchedule.isActive ? 'Schedule paused' : 'Schedule activated');
        fetchData();
      } else {
        toast.error('Failed to update schedule');
      }
    } catch (error) {
      console.error('Error toggling schedule:', error);
      toast.error('Failed to update schedule');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteSchedule = async () => {
    if (!selectedSchedule) return;
    try {
      setActionLoading(true);
      const response = await fetch(`${API_URL}/analysis/scheduled-prompts/${selectedSchedule._id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      if (response.ok) {
        toast.success('Schedule deleted successfully');
        setDeleteModal(false);
        setSelectedSchedule(null);
        fetchData();
      } else {
        toast.error('Failed to delete schedule');
      }
    } catch (error) {
      console.error('Error deleting schedule:', error);
      toast.error('Failed to delete schedule');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateFrequency = async (newFrequency) => {
    if (!selectedSchedule) return;
    try {
      setActionLoading(true);
      const response = await fetch(`${API_URL}/analysis/scheduled-prompts/${selectedSchedule._id}`, {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ 
          prompts: selectedSchedule.prompts,
          scheduleFrequency: newFrequency 
        }),
      });

      if (response.ok) {
        toast.success('Frequency updated');
        setFrequencyDropdown(false);
        fetchData();
      } else {
        toast.error('Failed to update frequency');
      }
    } catch (error) {
      console.error('Error updating frequency:', error);
      toast.error('Failed to update frequency');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateModels = async () => {
    if (!selectedSchedule) return;
    if (selectedModels.length === 0) {
      toast.error('Please select at least one AI model');
      return;
    }

    try {
      setActionLoading(true);
      const response = await fetch(`${API_URL}/analysis/scheduled-prompts/${selectedSchedule._id}/models`, {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ aiModels: selectedModels }),
      });

      if (response.ok) {
        toast.success('AI models updated');
        setEditModelsModal(false);
        fetchData();
      } else {
        const err = await response.json().catch(() => ({}));
        toast.error(err.message || 'Failed to update AI models');
      }
    } catch (error) {
      console.error('Error updating models:', error);
      toast.error('Failed to update AI models');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditPrompt = (prompt, index) => {
    setEditPromptModal({ ...prompt, index });
    setEditPromptValue(prompt.prompt || '');
  };

  const handleSavePrompt = async () => {
    if (!editPromptValue.trim() || !selectedSchedule) {
      toast.error('Prompt cannot be empty');
      return;
    }

    try {
      setActionLoading(true);
      const updatedPrompts = [...selectedSchedule.prompts];
      updatedPrompts[editPromptModal.index] = {
        ...updatedPrompts[editPromptModal.index],
        prompt: editPromptValue.trim(),
      };

      const response = await fetch(`${API_URL}/analysis/scheduled-prompts/${selectedSchedule._id}`, {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ prompts: updatedPrompts }),
      });

      if (response.ok) {
        toast.success('Prompt updated');
        setEditPromptModal(null);
        fetchData();
      } else {
        const err = await response.json().catch(() => ({}));
        toast.error(err.message || 'Failed to update prompt');
      }
    } catch (error) {
      console.error('Error updating prompt:', error);
      toast.error('Failed to update prompt');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeletePrompt = async (index) => {
    if (!selectedSchedule) return;
    if (selectedSchedule.prompts.length <= 1) {
      toast.error('Cannot delete the last prompt');
      return;
    }

    try {
      setActionLoading(true);
      const updatedPrompts = selectedSchedule.prompts.filter((_, i) => i !== index);

      const response = await fetch(`${API_URL}/analysis/scheduled-prompts/${selectedSchedule._id}`, {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ prompts: updatedPrompts }),
      });

      if (response.ok) {
        toast.success('Prompt deleted');
        fetchData();
      } else {
        toast.error('Failed to delete prompt');
      }
    } catch (error) {
      console.error('Error deleting prompt:', error);
      toast.error('Failed to delete prompt');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSchedule = async () => {
    if (!latestReportId) {
      toast.error('No report available to schedule');
      return;
    }

    try {
      setScheduling(true);
      const resp = await fetch(`${API_URL}/analysis/schedule-from-report`, {
        method: 'POST',
        headers: getAuthHeaders(),
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

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getSearchScopeLabel = (scope, country) => {
    if (scope === 'local') return `Local`;
    if (scope === 'national' && country) return `National`;
    if (scope === 'national') return 'National';
    return 'Global';
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

  // No schedules - show empty state
  if (schedules.length === 0) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 bg-[#F8FAFC] dark:bg-dark-950 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white">Scheduled Reports</h1>
            {brandData && (
              <p className="text-gray-600 dark:text-gray-400 mt-1">{brandData.brandName}</p>
            )}
          </div>

          <div className="bg-white dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-xl p-12 text-center">
            <Calendar className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">No Scheduled Reports</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              You haven't scheduled any reports for this brand yet.
            </p>
            <button
              onClick={() => setShowScheduleModal(true)}
              disabled={!latestReportId}
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Calendar className="w-5 h-5" />
              Schedule Your First Report
            </button>
            {!latestReportId && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
                Run a report first to enable scheduling.
              </p>
            )}
          </div>
        </div>

        {/* Schedule Modal */}
        {showScheduleModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-xl p-6 w-full max-w-md">
              <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Schedule Report</h3>
              <div className="space-y-4 mb-6">
                <p className="text-gray-600 dark:text-gray-400">
                  Select how often you want this report to run automatically.
                </p>
                <div className="flex gap-2">
                  {['daily', 'weekly', 'monthly'].map((freq) => (
                    <button
                      key={freq}
                      onClick={() => setScheduleFrequency(freq)}
                      className={`flex-1 px-4 py-2 rounded-lg border capitalize transition-colors ${
                        scheduleFrequency === freq
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400'
                          : 'border-gray-200 dark:border-dark-600 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                      }`}
                    >
                      {freq}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowScheduleModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 dark:bg-dark-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-600 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSchedule}
                  disabled={scheduling}
                  className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors font-medium disabled:opacity-50"
                >
                  {scheduling ? 'Scheduling...' : 'Schedule Now'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Has schedules - show dashboard
  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-[#F8FAFC] dark:bg-dark-950 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header with Schedule Selector */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white">
                Scheduled Report Details
              </h1>
              {selectedSchedule && (
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    selectedSchedule.isActive
                      ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                  }`}
                >
                  {selectedSchedule.isActive ? '● Active' : '● Paused'}
                </span>
              )}
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Manage prompts, frequency, and settings for this report schedule.
            </p>
          </div>

          {/* Schedule Selector (if multiple schedules) */}
          {schedules.length > 1 && (
            <div className="relative">
              <button
                onClick={() => setScheduleSelector(!scheduleSelector)}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-600 rounded-lg hover:border-gray-300 dark:hover:border-dark-500 transition-colors"
              >
                <span className="text-gray-700 dark:text-gray-300 font-medium">
                  {selectedSchedule?.brandName || 'Select Schedule'}
                </span>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>
              {scheduleSelector && (
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-600 rounded-lg shadow-lg z-20">
                  {schedules.map((schedule) => (
                    <button
                      key={schedule._id}
                      onClick={() => {
                        setSelectedSchedule(schedule);
                        setSelectedModels(schedule.aiModels || []);
                        setScheduleSelector(false);
                      }}
                      className={`w-full text-left px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-dark-700 first:rounded-t-lg last:rounded-b-lg ${
                        selectedSchedule?._id === schedule._id
                          ? 'bg-primary-50 dark:bg-primary-500/10'
                          : ''
                      }`}
                    >
                      <div>
                        <p className={`font-medium ${
                          selectedSchedule?._id === schedule._id
                            ? 'text-primary-600 dark:text-primary-400'
                            : 'text-gray-700 dark:text-gray-300'
                        }`}>
                          {schedule.brandName}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {schedule.prompts?.length || 0} prompts • {schedule.scheduleFrequency}
                        </p>
                      </div>
                      {selectedSchedule?._id === schedule._id && (
                        <Check className="w-4 h-4 text-primary-500" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={handleToggleSchedule}
            disabled={actionLoading}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors font-medium ${
              selectedSchedule?.isActive
                ? 'border-yellow-500 text-yellow-600 hover:bg-yellow-50 dark:text-yellow-400 dark:hover:bg-yellow-500/10'
                : 'border-green-500 text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-500/10'
            }`}
          >
            {selectedSchedule?.isActive ? (
              <>
                <Pause className="w-4 h-4" /> Pause Schedule
              </>
            ) : (
              <>
                <Play className="w-4 h-4" /> Resume Schedule
              </>
            )}
          </button>
          <button
            onClick={() => setDeleteModal(true)}
            disabled={actionLoading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-red-500 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10 transition-colors font-medium"
          >
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        </div>

        {/* Progress Bar */}
        <div className="h-1 bg-gradient-to-r from-primary-500 via-blue-500 to-green-500 rounded-full mb-6"></div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {/* Frequency */}
          <div className="bg-white dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-xl p-4 relative">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Frequency</p>
            <div className="relative">
              <button
                onClick={() => setFrequencyDropdown(!frequencyDropdown)}
                className="flex items-center gap-2 text-gray-800 dark:text-white font-semibold"
              >
                <Calendar className="w-5 h-5 text-primary-500" />
                <span className="capitalize">{selectedSchedule?.scheduleFrequency}</span>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>
              {frequencyDropdown && (
                <div className="absolute top-full left-0 mt-2 w-40 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-600 rounded-lg shadow-lg z-10">
                  {['daily', 'weekly', 'monthly'].map((freq) => (
                    <button
                      key={freq}
                      onClick={() => handleUpdateFrequency(freq)}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-dark-700 capitalize first:rounded-t-lg last:rounded-b-lg ${
                        selectedSchedule?.scheduleFrequency === freq
                          ? 'text-primary-500 font-medium'
                          : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {freq}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Next Run */}
          <div className="bg-white dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-xl p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Next Run</p>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-500" />
              <span className="text-gray-800 dark:text-white font-semibold">
                {formatDate(selectedSchedule?.nextRun)}
              </span>
            </div>
          </div>

          {/* Last Run */}
          <div className="bg-white dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-xl p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Last Run</p>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-gray-400" />
              <span className="text-gray-800 dark:text-white font-semibold">
                {selectedSchedule?.lastRun ? formatDate(selectedSchedule.lastRun) : 'Never'}
              </span>
            </div>
          </div>

          {/* Search Scope */}
          <div className="bg-white dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-xl p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Search Scope</p>
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-green-500" />
              <span className="text-gray-800 dark:text-white font-semibold">
                {getSearchScopeLabel(selectedSchedule?.searchScope, selectedSchedule?.country)}
              </span>
              {selectedSchedule?.country && (
                <span className="px-2 py-0.5 bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-gray-300 text-xs rounded">
                  {selectedSchedule.country}
                </span>
              )}
            </div>
          </div>

          {/* Active Models */}
          <div className="bg-white dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-xl p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Active Models</p>
            <div className="flex items-center gap-2">
              <div className="flex -space-x-1">
                {selectedSchedule?.aiModels?.map((model) => {
                  const config = MODEL_CONFIG[model];
                  if (!config) return null;
                  return (
                    <div
                      key={model}
                      className={`w-7 h-7 rounded-full ${config.bgColor} flex items-center justify-center border-2 border-white dark:border-dark-900`}
                      title={config.name}
                    >
                      <span className={`text-xs font-bold ${config.color}`}>
                        {config.shortName.charAt(0)}
                      </span>
                    </div>
                  );
                })}
              </div>
              <button
                onClick={() => {
                  setSelectedModels(selectedSchedule?.aiModels || []);
                  setEditModelsModal(true);
                }}
                className="text-primary-500 hover:text-primary-400 text-sm font-medium ml-1"
              >
                Edit
              </button>
            </div>
          </div>
        </div>

        {/* Credits Warning */}
        <div
          className={`rounded-xl p-4 mb-6 flex items-start gap-3 ${
            hasEnoughCredits
              ? 'bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30'
              : 'bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30'
          }`}
        >
          {hasEnoughCredits ? (
            <Zap className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          )}
          <div>
            <p className={`font-semibold ${hasEnoughCredits ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
              {hasEnoughCredits ? 'Credits Available' : 'Insufficient Credits'}
            </p>
            <p className={`text-sm ${hasEnoughCredits ? 'text-green-600 dark:text-green-300' : 'text-red-600 dark:text-red-300'}`}>
              Next run will cost <strong>{creditsNeeded} credits</strong> ({selectedSchedule?.prompts?.length || 0} prompts × {selectedSchedule?.aiModels?.length || 0} models).
              You currently have <strong>{userCredits} credits</strong>.
              {!hasEnoughCredits && (
                <button
                  onClick={() => navigate('/buy-credits')}
                  className="ml-2 underline hover:no-underline"
                >
                  Buy more credits
                </button>
              )}
            </p>
          </div>
        </div>

        {/* Prompts Table */}
        <div className="bg-white dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-xl overflow-hidden">
          {/* Table Header */}
          <div className="p-4 border-b border-gray-200 dark:border-dark-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-gray-800 dark:text-white">Scheduled Prompts</h2>
              <span className="px-2 py-0.5 bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-gray-300 text-sm rounded-full">
                {selectedSchedule?.prompts?.length || 0}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search prompts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-gray-50 dark:bg-dark-800 border border-gray-200 dark:border-dark-600 rounded-lg text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 w-64"
                />
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-dark-800">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Prompt Query
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Category
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Platforms
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
                {filteredPrompts.length > 0 ? (
                  filteredPrompts.map((prompt, index) => {
                    const originalIndex = selectedSchedule?.prompts?.findIndex(
                      (p) => p.prompt === prompt.prompt && p.promptIndex === prompt.promptIndex
                    );
                    return (
                      <tr key={prompt._id || index} className="hover:bg-gray-50 dark:hover:bg-dark-800/50 transition-colors">
                        <td className="px-4 py-4">
                          <p className="text-gray-800 dark:text-white text-sm max-w-md">
                            {prompt.prompt}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <span className="inline-block px-3 py-1 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs rounded-full truncate max-w-[200px]">
                            {prompt.category || 'Uncategorized'}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex gap-1">
                            {selectedSchedule?.aiModels?.map((model) => {
                              const config = MODEL_CONFIG[model];
                              if (!config) return null;
                              return (
                                <span
                                  key={model}
                                  className={`w-6 h-6 rounded-full ${config.bgColor} flex items-center justify-center`}
                                  title={config.name}
                                >
                                  <span className={`text-xs font-bold ${config.color}`}>
                                    {config.shortName.charAt(0)}
                                  </span>
                                </span>
                              );
                            })}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleEditPrompt(prompt, originalIndex >= 0 ? originalIndex : index)}
                              className="p-2 text-gray-500 hover:text-primary-500 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
                              title="Edit prompt"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeletePrompt(originalIndex >= 0 ? originalIndex : index)}
                              className="p-2 text-gray-500 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
                              title="Delete prompt"
                              disabled={selectedSchedule?.prompts?.length <= 1}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      {searchQuery ? 'No prompts match your search' : 'No prompts added yet'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Delete Scheduled Report?</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete this scheduled report? This action cannot be undone and all scheduled prompts will be lost.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteModal(false)}
                className="flex-1 px-4 py-2 bg-gray-100 dark:bg-dark-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-600 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSchedule}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50"
              >
                {actionLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Models Modal */}
      {editModelsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800 dark:text-white">Edit Active Models</h3>
              <button
                onClick={() => setEditModelsModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
              Select which AI models should be used for this scheduled report.
            </p>
            <div className="space-y-3 mb-6">
              {Object.values(MODEL_CONFIG).map((model) => (
                <label
                  key={model.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedModels.includes(model.id)
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-500/10'
                      : 'border-gray-200 dark:border-dark-600 hover:border-gray-300 dark:hover:border-dark-500'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedModels.includes(model.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedModels([...selectedModels, model.id]);
                      } else {
                        setSelectedModels(selectedModels.filter((m) => m !== model.id));
                      }
                    }}
                    className="sr-only"
                  />
                  <div className={`w-10 h-10 rounded-lg ${model.bgColor} flex items-center justify-center`}>
                    <span className={`text-lg font-bold ${model.color}`}>{model.shortName.charAt(0)}</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-800 dark:text-white">{model.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{model.shortName}</p>
                  </div>
                  {selectedModels.includes(model.id) && (
                    <Check className="w-5 h-5 text-primary-500" />
                  )}
                </label>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setEditModelsModal(false)}
                className="flex-1 px-4 py-2 bg-gray-100 dark:bg-dark-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-600 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateModels}
                disabled={actionLoading || selectedModels.length === 0}
                className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors font-medium disabled:opacity-50"
              >
                {actionLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Prompt Modal */}
      {editPromptModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-xl p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800 dark:text-white">Edit Prompt</h3>
              <button
                onClick={() => setEditPromptModal(null)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Prompt Query
              </label>
              <textarea
                value={editPromptValue}
                onChange={(e) => setEditPromptValue(e.target.value)}
                rows={3}
                className="w-full bg-gray-50 dark:bg-dark-800 border border-gray-200 dark:border-dark-600 rounded-lg px-4 py-2 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Enter the prompt query..."
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setEditPromptModal(null)}
                className="flex-1 px-4 py-2 bg-gray-100 dark:bg-dark-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-600 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePrompt}
                disabled={actionLoading || !editPromptValue.trim()}
                className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors font-medium disabled:opacity-50"
              >
                {actionLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default BrandScheduledReports;
