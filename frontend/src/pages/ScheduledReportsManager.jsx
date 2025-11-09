import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Sidebar from '../components/Sidebar';
import { Calendar, Trash2, Play, Pause, Clock, TrendingUp, ArrowLeft } from 'lucide-react';

const ScheduledReportsManager = () => {
  const { brandId } = useParams();
  const navigate = useNavigate();
  const [scheduledReports, setScheduledReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [brandName, setBrandName] = useState('');

  useEffect(() => {
    fetchScheduledReports();
  }, [brandId]);

  const fetchScheduledReports = async () => {
    setLoading(true);
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    
    try {
      const response = await fetch(`${API_URL}/analysis/scheduled-prompts?brandId=${brandId}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const { data } = await response.json();
        setScheduledReports(data);
        if (data.length > 0) {
          setBrandName(data[0].brandName);
        }
      } else {
        toast.error('Failed to fetch scheduled reports');
      }
    } catch (error) {
      console.error('Error fetching scheduled reports:', error);
      toast.error('Error loading scheduled reports');
    } finally {
      setLoading(false);
    }
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
        fetchScheduledReports(); // Refresh the list
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
        fetchScheduledReports(); // Refresh the list
      } else {
        toast.error('Failed to delete scheduled report');
      }
    } catch (error) {
      console.error('Error deleting scheduled report:', error);
      toast.error('Error deleting scheduled report');
    }
  };

  const getFrequencyLabel = (frequency) => {
    const labels = {
      daily: 'Daily',
      weekly: 'Weekly',
      biweekly: 'Bi-weekly',
      monthly: 'Monthly',
    };
    return labels[frequency] || frequency;
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-900">
        <Sidebar />
        <div className="flex-1 lg:ml-64 mt-16 lg:mt-0 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4" />
            <p className="text-gray-400">Loading scheduled reports...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-900">
      <Sidebar />
      
      <div className="flex-1 lg:ml-64 mt-16 lg:mt-0 overflow-auto">
        <div className="max-w-7xl mx-auto p-4 sm:p-6">
          {/* Header */}
          <div className="mb-4 sm:mb-6">
            <button
              onClick={() => navigate('/reports')}
              className="flex items-center gap-2 text-gray-400 hover:text-white mb-3 sm:mb-4 transition-colors text-sm sm:text-base"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Reports
            </button>
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                  Scheduled Reports
                </h1>
                <p className="text-sm sm:text-base text-gray-400">
                  Manage automated reports for {brandName || 'your brand'}
                </p>
              </div>
              
              <div className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-gray-800 rounded-lg border border-gray-700">
                <Calendar className="w-5 h-5 text-primary-500" />
                <span className="text-white font-medium text-sm sm:text-base">{scheduledReports.length} Active Schedule{scheduledReports.length !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>

          {/* Scheduled Reports List */}
          {scheduledReports.length === 0 ? (
            <div className="bg-gray-800 rounded-lg p-8 sm:p-12 text-center border border-gray-700">
              <Calendar className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg sm:text-xl font-semibold text-white mb-2">No Scheduled Reports</h3>
              <p className="text-sm sm:text-base text-gray-400 mb-6">You haven't scheduled any reports for this brand yet.</p>
              <button
                onClick={() => navigate('/reports')}
                className="px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
              >
                Create a Report
              </button>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {scheduledReports.map((report) => (
                <div
                  key={report._id}
                  className="bg-gray-800 rounded-lg p-4 sm:p-6 border border-gray-700 hover:border-gray-600 transition-all"
                >
                  <div className="flex flex-col lg:flex-row items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 w-full">
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-3">
                        <h3 className="text-lg sm:text-xl font-semibold text-white break-words">
                          {report.brandName}
                        </h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          report.isActive 
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                            : 'bg-gray-700 text-gray-400 border border-gray-600'
                        }`}>
                          {report.isActive ? 'Active' : 'Paused'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mb-4">
                        <div className="flex items-center gap-2 text-gray-400">
                          <Clock className="w-4 h-4" />
                          <span className="text-sm">
                            <span className="text-white font-medium">{getFrequencyLabel(report.scheduleFrequency)}</span> reports
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2 text-gray-400">
                          <TrendingUp className="w-4 h-4" />
                          <span className="text-sm">
                            Last run: <span className="text-white">{report.lastRun ? new Date(report.lastRun).toLocaleDateString() : 'Never'}</span>
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2 text-gray-400">
                          <Calendar className="w-4 h-4" />
                          <span className="text-sm">
                            Next run: <span className="text-white">{report.nextRun ? new Date(report.nextRun).toLocaleDateString() : 'Not scheduled'}</span>
                          </span>
                        </div>
                      </div>

                      <div className="text-xs sm:text-sm text-gray-400">
                        <p className="mb-1 break-all">
                          <span className="font-medium text-gray-300">URL:</span> {report.brandUrl}
                        </p>
                        <p className="mb-1">
                          <span className="font-medium text-gray-300">Scope:</span> {report.searchScope === 'local' ? `Local (${report.location})` : 'National'}
                        </p>
                        <p>
                          <span className="font-medium text-gray-300">Platforms:</span> {report.aiModels.join(', ')}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2 w-full lg:w-auto">
                      <button
                        onClick={() => handleToggle(report._id, report.isActive)}
                        className={`p-2 sm:p-3 rounded-lg transition-all flex-1 lg:flex-initial ${
                          report.isActive
                            ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 border border-yellow-500/30'
                            : 'bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30'
                        }`}
                        title={report.isActive ? 'Pause Schedule' : 'Resume Schedule'}
                      >
                        {report.isActive ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                      </button>
                      
                      <button
                        onClick={() => handleDelete(report._id)}
                        className="p-2 sm:p-3 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-all border border-red-500/30 flex-1 lg:flex-initial"
                        title="Delete Schedule"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScheduledReportsManager;
