import { useLocation, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { Calendar, ArrowLeft } from 'lucide-react';

const ScheduleReport = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { reportId } = location.state || {};

  return (
    <div className="flex h-screen bg-gray-900">
      <Sidebar />
      
      <div className="flex-1 overflow-auto ml-64">
        <div className="max-w-4xl mx-auto p-6">
          {/* Back Button */}
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Report
          </button>

          {/* Header */}
          <div className="bg-gray-800 rounded-lg p-8 mb-6 border border-gray-700 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
              <Calendar className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Schedule Report
            </h1>
            <p className="text-gray-400">
              Coming Soon! Set up automated report generation and delivery.
            </p>
          </div>

          {/* Feature Preview */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-xl font-bold text-white mb-4">Upcoming Features</h2>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-primary-500 rounded-full mt-2"></div>
                <div>
                  <h3 className="text-white font-medium">Automated Report Generation</h3>
                  <p className="text-gray-400 text-sm">Schedule reports to run daily, weekly, or monthly</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-primary-500 rounded-full mt-2"></div>
                <div>
                  <h3 className="text-white font-medium">Email Delivery</h3>
                  <p className="text-gray-400 text-sm">Get reports delivered directly to your inbox</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-primary-500 rounded-full mt-2"></div>
                <div>
                  <h3 className="text-white font-medium">Trend Analysis</h3>
                  <p className="text-gray-400 text-sm">Track visibility changes over time</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-primary-500 rounded-full mt-2"></div>
                <div>
                  <h3 className="text-white font-medium">Custom Alerts</h3>
                  <p className="text-gray-400 text-sm">Get notified when visibility metrics change significantly</p>
                </div>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="mt-6 bg-gradient-to-r from-primary-500 to-accent-500 rounded-lg p-6 text-center">
            <h3 className="text-white font-bold text-lg mb-2">
              Want early access to scheduled reports?
            </h3>
            <p className="text-white/90 text-sm mb-4">
              Contact us to be notified when this feature launches
            </p>
            <button
              onClick={() => navigate('/profile')}
              className="px-6 py-3 bg-white text-primary-600 rounded-lg font-medium hover:bg-gray-100 transition-colors"
            >
              Go to Profile
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScheduleReport;
