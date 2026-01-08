import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Zap, 
  Plus, 
  Sparkles, 
  FileText, 
  Building2, 
  Gift, 
  CreditCard, 
  User, 
  LogOut,
  Menu,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from './ThemeToggle';

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const menuItems = [
    { 
      name: 'New Report', 
      path: '/reports/new', 
      icon: Plus, 
      gradient: 'from-purple-500 to-pink-500',
    },
    { 
      name: 'Reports', 
      path: '/reports', 
      icon: FileText, 
      gradient: 'from-blue-500 to-cyan-500'
    },
    { 
      name: 'My Brands', 
      path: '/brands', 
      icon: Building2, 
      gradient: 'from-purple-500 to-indigo-500'
    },
    // { 
    //   name: 'Earn Free Credits', 
    //   path: '/earn-credits', 
    //   icon: Gift, 
    //   gradient: 'from-orange-500 to-amber-500'
    // },
    { 
      name: 'Buy Credits', 
      path: '/buy-credits', 
      icon: CreditCard, 
      gradient: 'from-purple-600 to-purple-400'
    },
    { 
      name: 'Profile', 
      path: '/profile', 
      icon: User, 
      gradient: 'from-gray-600 to-gray-500'
    },
  ];

  const isActive = (path) => location.pathname === path;

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 glass-effect rounded-xl border border-gray-200 dark:border-dark-700 text-gray-800 dark:text-gray-200 hover:bg-white/10 dark:hover:bg-dark-700/50 transition-all"
        aria-label="Toggle menu"
      >
        {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Overlay for mobile */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          onClick={closeMobileMenu}
        />
      )}

      {/* Sidebar */}
      <div className={`h-screen w-64 bg-gray-100 dark:bg-dark-900 border-r border-gray-200 dark:border-dark-700 flex flex-col fixed left-0 top-0 z-50 transition-transform duration-300 ease-in-out ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
      {/* Logo */}
      <div className="p-6 border-b border-gray-200 dark:border-dark-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary-500 to-accent-500 rounded-xl blur-lg opacity-50"></div>
              <div className="relative bg-gradient-to-r from-primary-500 to-accent-500 p-2 rounded-xl">
                <Zap className="w-5 h-5 text-white" />
              </div>
            </div>
            <span className="text-xl font-bold gradient-text">PromptVerse</span>
          </div>
          <ThemeToggle />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {menuItems.map((item) => (
          <div key={item.name}>
            {item.border ? (
              <Link
                to={item.path}
                className={`flex items-center justify-between p-3 rounded-xl border-2 border-white/20 transition-all group hover:border-white/40 ${
                  isActive(item.path) ? 'bg-white/10 dark:bg-dark-700/50 border-white/40 dark:border-dark-600' : ''
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-lg">
                    <item.icon className="w-5 h-5 text-[#4F46E5]" />
                  </div>
                  <span className="text-gray-800 dark:text-gray-200 font-medium">{item.name}</span>
                </div>
              </Link>
            ) : (
              <>
                <Link
                  to={item.path}
                  className={`flex items-center justify-between p-3 rounded-xl transition-all group hover:bg-white/10 dark:hover:bg-dark-800/50 ${
                    isActive(item.path) ? 'bg-white/10 dark:bg-dark-700' : ''
                  }`}
                  onClick={closeMobileMenu}
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-lg">
                      <item.icon className="w-5 h-5 text-[#4F46E5]" />
                    </div>
                    <span className={`font-medium ${isActive(item.path) ? 'text-gray-800 dark:text-white' : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-800 dark:group-hover:text-white'}`}>
                      {item.name}
                    </span>
                  </div>
                  {item.badge && (
                    <span className="text-xs bg-white/10 dark:bg-dark-700 px-2 py-1 rounded text-gray-500 dark:text-gray-400">
                      {item.badge}
                    </span>
                  )}
                </Link>
              </>
            )}
          </div>
        ))}
      </nav>

      {/* User Section */}
      <div className="p-4 border-t border-gray-200 dark:border-dark-700">
        <div className="bg-white dark:bg-dark-800 rounded-xl p-4">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-primary-500 to-accent-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-gray-800 dark:text-white text-sm font-medium truncate">
                {user?.name || 'User'}
              </p>
              <p className="text-gray-500 dark:text-gray-400 text-xs capitalize">
                {user?.currentPlan || 'free'} Plan
              </p>
            </div>
          </div>
          
          <div className="flex items-center justify-between mb-3 p-2 bg-gray-100 dark:bg-dark-700 rounded-lg">
            <div className="flex items-center space-x-2">
              <Zap className="w-4 h-4 text-primary-500" />
              <span className="text-gray-700 dark:text-gray-300 text-sm">Credits</span>
            </div>
            <span className="text-gray-800 dark:text-white font-semibold text-sm">
              {user?.credits || 0} available
            </span>
          </div>
          
          <p className="text-gray-500 dark:text-gray-400 text-xs mb-3">
            {user?.credits || 0} total credits
          </p>
          
          <button
            onClick={logout}
            className="w-full flex items-center justify-center space-x-2 p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-all text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white"
          >
            <LogOut className="w-4 h-4 text-red-600" />
            <span className="text-sm text-red-600">Sign Out</span>
          </button>
        </div>
      </div>
    </div>
    </>
  );
};

export default Sidebar;
