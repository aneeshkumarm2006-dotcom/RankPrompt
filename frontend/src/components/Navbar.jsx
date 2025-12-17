import { Menu, X, Zap } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { isAuthenticated } = useAuth();

  return (
    <nav className="fixed w-full z-50 bg-white dark:bg-dark-900 border-b border-gray-200 dark:border-dark-700 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary-500 to-accent-500 rounded-xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity"></div>
              <div className="relative bg-gradient-to-r from-primary-500 to-accent-500 p-2.5 rounded-xl">
                <Zap className="w-6 h-6 text-white" />
              </div>
            </div>
            <span className="text-2xl font-bold gradient-text">
              RankPrompt
            </span>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-1">
            <a href="#features" className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-action-500 dark:hover:text-action-400 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-dark-800">
              Features
            </a>
            <a href="#how-it-works" className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-action-500 dark:hover:text-action-400 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-dark-800">
              How It Works
            </a>
            <a href="#pricing" className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-action-500 dark:hover:text-action-400 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-dark-800">
              Pricing
            </a>
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="ml-4 px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-action-500 dark:hover:text-action-400 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-dark-800"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-action-500 dark:hover:text-action-400 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-dark-800 ml-4"
                >
                  Sign In
                </Link>
                <Link to="/register" className="ml-2 bg-action-600 text-white px-6 py-2.5 rounded-full font-semibold hover:bg-action-700 transition-all duration-300">
                  Get Started Free
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-gray-600 dark:text-gray-300 hover:text-action-500 dark:hover:text-action-400 p-2 ml-2"
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div className="md:hidden py-4 space-y-2 border-t border-gray-200 dark:border-dark-700 animate-slide-down bg-white dark:bg-dark-900">
            <a href="#features" onClick={() => setIsOpen(false)} className="block px-4 py-3 text-gray-600 dark:text-gray-300 hover:text-action-500 dark:hover:text-action-400 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-lg transition-colors">
              Features
            </a>
            <a href="#how-it-works" onClick={() => setIsOpen(false)} className="block px-4 py-3 text-gray-600 dark:text-gray-300 hover:text-action-500 dark:hover:text-action-400 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-lg transition-colors">
              How It Works
            </a>
            <a href="#pricing" onClick={() => setIsOpen(false)} className="block px-4 py-3 text-gray-600 dark:text-gray-300 hover:text-action-500 dark:hover:text-action-400 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-lg transition-colors">
              Pricing
            </a>
            {isAuthenticated ? (
              <Link to="/dashboard" onClick={() => setIsOpen(false)} className="block px-4 py-3 text-gray-600 dark:text-gray-300 hover:text-action-500 dark:hover:text-action-400 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-lg transition-colors">
                Dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" onClick={() => setIsOpen(false)} className="block px-4 py-3 text-gray-600 dark:text-gray-300 hover:text-action-500 dark:hover:text-action-400 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-lg transition-colors">
                  Sign In
                </Link>
                <Link to="/register" onClick={() => setIsOpen(false)} className="block w-full bg-action-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-action-700 transition-all mt-2 text-center">
                  Get Started Free
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
