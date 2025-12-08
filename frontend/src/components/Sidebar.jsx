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
        className="lg:hidden fixed top-4 left-4 z-50 p-2 glass-effect rounded-xl border border-gray-200 text-gray-800 hover:bg-white/10 transition-all"
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
      <div className={`h-screen w-64 bg-[#F1F5F9] border-r border-gray-200 flex flex-col fixed left-0 top-0 z-50 transition-transform duration-300 ease-in-out ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
      {/* Logo */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-primary-500 to-accent-500 rounded-xl blur-lg opacity-50"></div>
            <div className="relative bg-gradient-to-r from-primary-500 to-accent-500 p-2 rounded-xl">
              <Zap className="w-5 h-5 text-gray-800" />
            </div>
          </div>
          <span className="text-xl font-bold gradient-text">RankPrompt</span>
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
                  isActive(item.path) ? 'bg-white/10 border-white/40' : ''
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-lg">
                    <item.icon className="w-5 h-5 text-[#4F46E5]" />
                  </div>
                  <span className="text-gray-800 font-medium">{item.name}</span>
                </div>
              </Link>
            ) : (
              <>
                <Link
                  to={item.path}
                  className={`flex items-center justify-between p-3 rounded-xl transition-all group hover:bg-white/10 ${
                    isActive(item.path) ? 'bg-white/10' : ''
                  }`}
                  onClick={closeMobileMenu}
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-lg">
                      <item.icon className="w-5 h-5 text-[#4F46E5]" />
                    </div>
                    <span className={`font-medium ${isActive(item.path) ? 'text-[#0F172A]' : 'text-[#475569] group-hover:text-[#0F172A]'}`}>
                      {item.name}
                    </span>
                  </div>
                  {item.badge && (
                    <span className="text-xs bg-white/10 px-2 py-1 rounded text-gray-500">
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
      <div className="p-4 border-t border-gray-200">
        <div className="bg-white rounded-xl p-4">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-primary-500 to-accent-500 flex items-center justify-center">
              <span className="text-gray-800 font-bold text-sm">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-gray-800 text-sm font-medium truncate">
                {user?.name || 'User'}
              </p>
              <p className="text-gray-500 text-xs">Free Plan</p>
            </div>
          </div>
          
          <div className="flex items-center justify-between mb-3 p-2 bg-gray-100 rounded-lg">
            <div className="flex items-center space-x-2">
              <Zap className="w-4 h-4 text-primary-500" />
              <span className="text-gray-700 text-sm">Credits</span>
            </div>
            <span className="text-gray-800 font-semibold text-sm">
              {user?.credits || 0} available
            </span>
          </div>
          
          <p className="text-gray-500 text-xs mb-3">
            {user?.credits || 0} total credits
          </p>
          
          <button
            onClick={logout}
            className="w-full flex items-center justify-center space-x-2 p-2 hover:bg-gray-100 rounded-lg transition-all text-gray-500 hover:text-gray-800"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm">Sign Out</span>
          </button>
        </div>
      </div>
    </div>
    </>
  );
};

export default Sidebar;
