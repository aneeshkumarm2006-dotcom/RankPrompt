import { useEffect, useState } from 'react';
import { Loader, CheckCircle, XCircle, Clock, TrendingUp } from 'lucide-react';
import { getAuthHeaders } from '../services/api';

const AnalysisProgressModal = ({ isOpen, batchId, onComplete, onClose }) => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !batchId) return;

    const pollStatus = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const response = await fetch(`${API_URL}/analysis/status/${batchId}`, {
          headers: getAuthHeaders(),
          credentials: 'include',
        });

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.message || 'Failed to fetch status');
        }

        setStatus(data.data);
        setLoading(false);

        // If completed, notify parent
        if (data.data.status === 'completed' || data.data.status === 'partial_completed') {
          setTimeout(() => {
            onComplete(batchId);
          }, 1500);
        }
      } catch (err) {
        console.error('Error polling status:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    // Initial fetch
    pollStatus();

    // Poll every 2 seconds
    const interval = setInterval(pollStatus, 2000);

    return () => clearInterval(interval);
  }, [isOpen, batchId, onComplete]);

  if (!isOpen) return null;

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'text-green-400';
      case 'processing':
        return 'text-blue-400';
      case 'partial_completed':
        return 'text-yellow-400';
      case 'failed':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const getEstimatedTime = () => {
    if (!status) return 'Calculating...';

    if (status.status === 'completed') return 'Completed!';

    const now = new Date();
    const estimated = new Date(status.estimatedCompletionTime);
    const diff = Math.max(0, estimated - now);
    const seconds = Math.ceil(diff / 1000);

    if (seconds < 60) return `${seconds}s remaining`;
    const minutes = Math.ceil(seconds / 60);
    return `${minutes}m remaining`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-dark-900 rounded-xl sm:rounded-2xl border border-gray-200 dark:border-dark-700 p-4 sm:p-6 md:p-8 max-w-2xl w-full animate-fade-in">
        {loading && !status ? (
          <div className="text-center py-8">
            <Loader className="w-12 h-12 text-primary-500 animate-spin mx-auto mb-4" />
            <p className="text-gray-800 dark:text-white text-lg">Initializing analysis...</p>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <p className="text-red-400 text-lg mb-4">Error: {error}</p>
            <button
              onClick={onClose}
              className="bg-primary-500 text-white px-6 py-2 rounded-xl"
            >
              Close
            </button>
          </div>
        ) : status ? (
          <div>
            {/* Header */}
            <div className="text-center mb-8">
              {status.status === 'completed' || status.status === 'partial_completed' ? (
                <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
              ) : (
                <Loader className="w-16 h-16 text-primary-500 animate-spin mx-auto mb-4" />
              )}
              <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">
                {status.status === 'completed'
                  ? 'Analysis Complete!'
                  : status.status === 'partial_completed'
                    ? 'Analysis Partially Complete'
                    : 'Analyzing Brand Visibility'}
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                {status.status === 'completed' || status.status === 'partial_completed'
                  ? 'Processing results...'
                  : getEstimatedTime()}
              </p>
            </div>

            {/* Progress Bar */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-800 dark:text-white font-medium">Overall Progress</span>
                <span className={`font-bold ${getStatusColor(status.status)}`}>
                  {status.progress}%
                </span>
              </div>
              <div className="w-full h-4 bg-gray-200 dark:bg-dark-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 transition-all duration-500 ease-out"
                  style={{ width: `${status.progress}%` }}
                />
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white dark:bg-dark-800 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-gray-800 dark:text-white mb-1">
                  {status.totalJobs}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Total Jobs</div>
              </div>
              <div className="bg-white dark:bg-dark-800 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-green-400 mb-1">
                  {status.jobStatus.completed}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Completed</div>
              </div>
              <div className="bg-white dark:bg-dark-800 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-blue-400 mb-1">
                  {status.jobStatus.processing}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Processing</div>
              </div>
              <div className="bg-white dark:bg-dark-800 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-yellow-400 mb-1">
                  {status.jobStatus.pending}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Pending</div>
              </div>
            </div>

            {/* Job Breakdown */}
            <div className="bg-gray-100 dark:bg-dark-800 rounded-xl p-4 mb-6">
              <h3 className="text-gray-800 dark:text-white font-semibold mb-3 flex items-center">
                <TrendingUp className="w-5 h-5 mr-2 text-primary-400" />
                API Calls Status
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">n8n-proxy Calls:</span>
                  <span className="text-gray-800 dark:text-white font-medium">{status.totalJobs}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">track_prompt_processing Calls:</span>
                  <span className="text-gray-800 dark:text-white font-medium">{status.totalJobs}</span>
                </div>
                <div className="flex items-center justify-between text-sm border-t border-gray-200 dark:border-dark-700 pt-2">
                  <span className="text-gray-700 dark:text-gray-300 font-medium">Total API Calls:</span>
                  <span className="text-primary-400 font-bold">{status.totalJobs * 2}</span>
                </div>
              </div>
            </div>

            {/* Status Message */}
            {status.status === 'processing' && (
              <div className="bg-white dark:bg-dark-800 rounded-xl p-4 mb-6">
                <div className="flex items-start space-x-3">
                  <Clock className="w-5 h-5 text-blue-400 mt-0.5" />
                  <div>
                    <p className="text-gray-800 dark:text-white font-medium mb-1">Analysis in Progress</p>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                      Each prompt is being analyzed across multiple AI services. This process
                      includes sending requests and tracking responses.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Failed Jobs Warning */}
            {status.jobStatus.failed > 0 && (
              <div className="bg-white dark:bg-dark-800 rounded-xl p-4 mb-6 border border-red-200 dark:border-red-500/30">
                <div className="flex items-start space-x-3">
                  <XCircle className="w-5 h-5 text-red-400 mt-0.5" />
                  <div>
                    <p className="text-red-400 font-medium mb-1">
                      {status.jobStatus.failed} jobs failed
                    </p>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                      Some jobs encountered errors. Results will be partial.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Close Button (only show when completed) */}
            {(status.status === 'completed' || status.status === 'partial_completed') && (
              <div className="text-center">
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                  Redirecting to results...
                </p>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default AnalysisProgressModal;
