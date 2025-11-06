import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Sidebar from '../components/Sidebar';
import { Calendar, ArrowLeft, Clock, CheckCircle, XCircle, ExternalLink, Trash2, Play, Pause, TrendingUp } from 'lucide-react';

const ScheduledReports = () => {
  const { brandId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [scheduledPrompt, setScheduledPrompt] = useState(null);
  const [reports, setReports] = useState([]);
  const [brandName, setBrandName] = useState('');

  useEffect(() => {
    fetchData();
  }, [brandId]);

  const fetchData = async () => {
    if (!brandId) {
      navigate('/reports');
      return;
    }

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    try {
      // Fetch ALL scheduled prompts for this brand (active and inactive)
      const scheduledResponse = await fetch(
        `${API_URL}/analysis/scheduled-prompts?brandId=${brandId}`,
        { credentials: 'include' }
      );

      if (scheduledResponse.ok) {
        const scheduledData = await scheduledResponse.json();
        if (scheduledData.data && scheduledData.data.length > 0) {
          setScheduledPrompt(scheduledData.data[0]);
          setBrandName(scheduledData.data[0].brandName);
        }
      }

      // Fetch all reports for this brand
      const reportsResponse = await fetch(
        `${API_URL}/reports/brand/${brandId}/all`,
        { credentials: 'include' }
      );

      if (reportsResponse.ok) {
        const reportsData = await reportsResponse.json();
        setReports(reportsData.data || []);
        if (reportsData.data && reportsData.data.length > 0 && !brandName) {
          setBrandName(reportsData.data[0].brandName);
        }
      }
    } catch (error) {
      console.error('Error fetching scheduled reports:', error);
      toast.error('Error loading scheduled reports');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getFrequencyLabel = (freq) => {
    const labels = {
      daily: 'Daily',
      weekly: 'Weekly',
      biweekly: 'Bi-weekly',
      monthly: 'Monthly',
    };
    return labels[freq] || freq;
  };

  const handleToggle = async (reportId, currentStatus) => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    
    try {
      const response = await fetch(`${API_URL}/analysis/scheduled-prompts/${reportId}/toggle`, {
        method: 'PUT',
        credentials: 'include',
      });

      if (response.ok) {
        const { message } = await response.json();
        toast.success(message);
        fetchData(); // Refresh the data
      } else {
        toast.error('Failed to toggle scheduled report');
      }
    } catch (error) {
      console.error('Error toggling scheduled report:', error);
      toast.error('Error updating scheduled report');
    }
  };

  const handleDelete = async (reportId) => {
    if (!confirm('Are you sure you want to delete this scheduled report? This action cannot be undone.')) {
      return;
    }

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    
    try {
      const response = await fetch(`${API_URL}/analysis/scheduled-prompts/${reportId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        toast.success('Scheduled report deleted successfully');
        fetchData(); // Refresh the data
      } else {
        toast.error('Failed to delete scheduled report');
      }
    } catch (error) {
      console.error('Error deleting scheduled report:', error);
      toast.error('Error deleting scheduled report');
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-900">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center ml-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading scheduled reports...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-900">
      <Sidebar />
      
      <div className="flex-1 overflow-auto ml-64">
        <div className="max-w-7xl mx-auto p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <h1 className="text-3xl font-bold text-white mb-2">
                Scheduled Reports - {brandName || 'Brand'}
              </h1>
              <p className="text-gray-400">
                View all reports and scheduling details for this brand
              </p>
            </div>
          </div>

          {/* Scheduled Prompt Info */}
          {scheduledPrompt && (
            <div className="bg-gray-800 rounded-lg p-6 mb-6 border border-gray-700">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-blue-600 rounded-lg">
                      <Calendar className="w-5 h-5 text-white" />
                    </div>
                    <h2 className="text-xl font-bold text-white">Schedule Details</h2>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      scheduledPrompt.isActive 
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                        : 'bg-gray-700 text-gray-400 border border-gray-600'
                    }`}>
                      {scheduledPrompt.isActive ? 'Active' : 'Paused'}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Frequency</p>
                      <p className="text-lg font-semibold text-white">
                        {getFrequencyLabel(scheduledPrompt.scheduleFrequency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Last Run</p>
                      <p className="text-lg font-semibold text-white">
                        {formatDate(scheduledPrompt.lastRun)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Next Run</p>
                      <p className="text-lg font-semibold text-green-400">
                        {formatDate(scheduledPrompt.nextRun)}
                      </p>
                    </div>
                  </div>

                  <div className="text-sm text-gray-400">
                    <p className="mb-1">
                      <span className="font-medium text-gray-300">URL:</span> {scheduledPrompt.brandUrl}
                    </p>
                    <p className="mb-1">
                      <span className="font-medium text-gray-300">Scope:</span> {scheduledPrompt.searchScope === 'local' ? `Local (${scheduledPrompt.location})` : 'National'}
                    </p>
                    <p>
                      <span className="font-medium text-gray-300">Platforms:</span> {scheduledPrompt.aiModels?.join(', ') || 'N/A'}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleToggle(scheduledPrompt._id, scheduledPrompt.isActive)}
                    className={`p-3 rounded-lg transition-all ${
                      scheduledPrompt.isActive
                        ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 border border-yellow-500/30'
                        : 'bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30'
                    }`}
                    title={scheduledPrompt.isActive ? 'Pause Schedule' : 'Resume Schedule'}
                  >
                    {scheduledPrompt.isActive ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                  </button>
                  
                  <button
                    onClick={() => handleDelete(scheduledPrompt._id)}
                    className="p-3 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-all border border-red-500/30"
                    title="Delete Schedule"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Reports List */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
            <div className="p-6 border-b border-gray-700">
              <h2 className="text-xl font-bold text-white">All Reports</h2>
              <p className="text-sm text-gray-400 mt-1">
                {reports.length} {reports.length === 1 ? 'report' : 'reports'} found
              </p>
            </div>

            {reports.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-gray-400 mb-4">No reports found for this brand</p>
                <button
                  onClick={() => navigate('/reports/new')}
                  className="px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                >
                  Create First Report
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-750">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Report Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Brand Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Search Scope
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Stats
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {reports.map((report) => (
                      <tr key={report._id} className="hover:bg-gray-750 transition-colors">
                        <td className="px-4 py-4 text-sm text-gray-300 whitespace-nowrap">
                          {formatDate(report.reportDate || report.createdAt)}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-300">
                          {report.brandName}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-400 capitalize">
                          {report.searchScope}
                        </td>
                        <td className="px-4 py-4 text-sm">
                          <div className="flex flex-col gap-1">
                            <span className="text-gray-400">
                              Prompts: <span className="text-white font-medium">{report.stats?.totalPrompts || 0}</span>
                            </span>
                            <span className="text-gray-400">
                              Findings: <span className="text-green-400 font-medium">{report.stats?.totalFindings || 0}</span>
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm">
                          <button
                            onClick={() => navigate(`/reports/${report._id}`)}
                            className="px-3 py-1 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors text-xs"
                          >
                            View Report
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScheduledReports;

