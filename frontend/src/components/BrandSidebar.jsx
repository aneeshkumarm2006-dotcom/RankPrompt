import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { 
  ArrowLeft,
  BarChart3,
  FileText,
  Share2,
  Calendar,
  Search,
  Zap,
  Lightbulb,
  MessageSquare,
  Settings,
  ChevronDown,
  Menu,
  X
} from 'lucide-react';

const BrandSidebar = ({ brandData }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { brandId } = useParams();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAiDashboardOpen, setIsAiDashboardOpen] = useState(true);

  const menuItems = [
    {
      title: 'AI Visibility Dashboard',
      icon: BarChart3,
      isExpandable: true,
      subItems: [
        { name: 'Performance Summary', path: `/brands/${brandId}/dashboard`, icon: BarChart3 },
        { name: 'All Prompts', path: `/brands/${brandId}/prompts`, icon: FileText },
        { name: 'All Reports', path: `/brands/${brandId}/reports`, icon: FileText },
        { name: 'All Scheduled Reports', path: `/brands/${brandId}/scheduled`, icon: Calendar },
      ]
    },
    { name: 'Citations & Sources', path: `/brands/${brandId}/citations`, icon: Share2 },
    { name: 'On-Page SEO Optimizer', path: `/brands/${brandId}/seo`, icon: Zap, comingSoon: true },
    { name: 'Technical AI-Readiness', path: `/brands/${brandId}/technical`, icon: Settings, comingSoon: true },
    { name: 'Content Engine', path: `/brands/${brandId}/content`, icon: Lightbulb, comingSoon: true },
    { name: 'Forum Strategy Hub', path: `/brands/${brandId}/forum`, icon: MessageSquare, comingSoon: true },
    { name: 'Brand Settings', path: `/brands/${brandId}/settings`, icon: Settings, comingSoon: true },
  ];

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-gray-900 border-b border-gray-800 p-4 z-40 flex items-center gap-3">
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="text-white p-2 hover:bg-gray-800 rounded-lg flex-shrink-0"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {brandData?.favicon ? (
            <img src={brandData.favicon} alt={brandData.brandName} className="w-8 h-8 rounded-lg flex-shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center text-white font-bold flex-shrink-0">
              {brandData?.brandName?.charAt(0).toUpperCase() || 'B'}
            </div>
          )}
          <span className="text-white font-semibold truncate">{brandData?.brandName || 'Brand'}</span>
        </div>
      </div>

      {/* Sidebar */}
      <div
        className={`fixed top-0 left-0 h-full w-64 bg-gray-900 border-r border-gray-800 z-50 transform transition-transform duration-300 ease-in-out ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="flex flex-col h-full">
          {/* Back to Brands */}
          <button
            onClick={() => navigate('/brands')}
            className="flex items-center gap-2 px-4 py-3 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors border-b border-gray-800"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to Brands</span>
          </button>

          {/* Brand Header */}
          <div className="px-4 py-4 border-b border-gray-800">
            <div className="flex items-center gap-3">
              {brandData?.favicon ? (
                <img
                  src={brandData.favicon}
                  alt={brandData.brandName}
                  className="w-10 h-10 rounded-lg flex-shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-primary-500 flex items-center justify-center text-white font-bold">
                  {brandData?.brandName?.charAt(0).toUpperCase() || 'B'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h2 className="text-white font-semibold text-sm truncate">{brandData?.brandName || 'Brand Name'}</h2>
                <p className="text-gray-400 text-xs truncate">{brandData?.websiteUrl?.replace(/^https?:\/\//, '') || 'website.com'}</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-4 px-2">
            {menuItems.map((item, index) => (
              <div key={index}>
                {item.isExpandable ? (
                  <div>
                    <button
                      onClick={() => setIsAiDashboardOpen(!isAiDashboardOpen)}
                      className="w-full flex items-center justify-between px-3 py-2 text-gray-300 hover:bg-gray-800 rounded-lg transition-colors mb-1"
                    >
                      <div className="flex items-center gap-3">
                        <item.icon className="w-5 h-5" />
                        <span className="text-sm font-medium">{item.title}</span>
                      </div>
                      <ChevronDown className={`w-4 h-4 transition-transform ${isAiDashboardOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isAiDashboardOpen && (
                      <div className="ml-6 space-y-1 mb-2">
                        {item.subItems.map((subItem, subIndex) => (
                          <Link
                            key={subIndex}
                            to={subItem.path}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                              location.pathname === subItem.path
                                ? 'bg-primary-500 text-white'
                                : 'text-gray-400 hover:text-white hover:bg-gray-800'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <subItem.icon className="w-4 h-4" />
                              <span>{subItem.name}</span>
                            </div>
                            {subItem.badge === 'lock' && (
                              <span className="text-xs bg-gray-700 px-2 py-0.5 rounded">🔒</span>
                            )}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <Link
                    to={item.comingSoon ? '#' : item.path}
                    onClick={(e) => {
                      if (item.comingSoon) {
                        e.preventDefault();
                      } else {
                        setIsMobileMenuOpen(false);
                      }
                    }}
                    className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg transition-colors mb-1 ${
                      item.comingSoon
                        ? 'text-gray-600 cursor-not-allowed'
                        : location.pathname === item.path
                        ? 'bg-primary-500 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="w-5 h-5" />
                      <span className="text-sm font-medium">{item.name}</span>
                    </div>
                    {item.comingSoon && (
                      <span className="text-xs bg-gray-800 text-gray-500 px-2 py-0.5 rounded">Soon</span>
                    )}
                  </Link>
                )}
              </div>
            ))}
          </nav>
        </div>
      </div>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </>
  );
};

export default BrandSidebar;
