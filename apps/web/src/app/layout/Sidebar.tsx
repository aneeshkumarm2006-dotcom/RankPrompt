import {
  Building2,
  CreditCard,
  FileText,
  Gift,
  LogOut,
  Menu,
  Plus,
  Settings,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router';
import { useLogout, useMe } from '../../lib/api/auth';
import { number } from '../../lib/format';
import { ThemeToggle } from '../theme/ThemeToggle';

interface NavItem {
  name: string;
  path: string;
  icon: LucideIcon;
  end?: boolean;
}

/** v1 Sidebar menu, mapped to v2 routes. "Earn Free Credits" is restored (F-31). */
const NAV: NavItem[] = [
  { name: 'New Brand', path: '/app/brands/new', icon: Plus },
  { name: 'Reports', path: '/app/runs', icon: FileText },
  { name: 'My Brands', path: '/app/brands', icon: Building2, end: true },
  { name: 'Earn Free Credits', path: '/app/credits', icon: Gift },
  { name: 'Buy Credits', path: '/app/billing', icon: CreditCard },
  { name: 'Settings', path: '/app/settings', icon: Settings },
];

export function Logo() {
  return (
    <div className="flex items-center space-x-3">
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-primary-500 to-accent-500 rounded-xl blur-lg opacity-50" />
        <div className="relative bg-gradient-to-r from-primary-500 to-accent-500 p-2 rounded-xl">
          <Zap className="w-5 h-5 text-white" />
        </div>
      </div>
      <span className="text-xl font-bold gradient-text">PromptVerse</span>
    </div>
  );
}

/** Credits and plan from `useMe` (F-35): correct right after login, unlike v1. */
function UserPanel() {
  const { data: me } = useMe();
  const logout = useLogout();
  const navigate = useNavigate();
  if (!me) return null;
  const { credits, plan } = me.workspace;

  return (
    <div className="bg-white dark:bg-dark-800 rounded-xl p-4">
      <div className="flex items-center space-x-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-primary-500 to-accent-500 flex items-center justify-center shrink-0">
          <span className="text-white font-bold text-sm">
            {me.user.name.charAt(0).toUpperCase() || 'U'}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-gray-800 dark:text-white text-sm font-medium truncate">
            {me.user.name}
          </p>
          <p className="text-gray-500 dark:text-gray-400 text-xs capitalize">{plan.tier} Plan</p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-2 p-2 bg-gray-100 dark:bg-dark-700 rounded-lg">
        <div className="flex items-center space-x-2">
          <Zap className="w-4 h-4 text-primary-500" />
          <span className="text-gray-700 dark:text-gray-300 text-sm">Credits</span>
        </div>
        <span
          className="text-gray-800 dark:text-white font-semibold text-sm"
          data-testid="sidebar-credits"
        >
          {number(credits.total)} available
        </span>
      </div>
      <p className="text-gray-500 dark:text-gray-400 text-xs mb-3">
        {number(credits.plan)} plan · {number(credits.purchased)} purchased
      </p>

      <button
        type="button"
        onClick={() =>
          logout.mutate(undefined, { onSettled: () => void navigate('/login', { replace: true }) })
        }
        disabled={logout.isPending}
        className="w-full flex items-center justify-center space-x-2 p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-all"
      >
        <LogOut className="w-4 h-4 text-red-600" />
        <span className="text-sm text-red-600">Sign Out</span>
      </button>
    </div>
  );
}

/** The main app sidebar (v1 `Sidebar.jsx`), with the same mobile drawer. */
export function Sidebar() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 glass-effect rounded-xl border border-gray-200 dark:border-dark-700 text-gray-800 dark:text-gray-200 hover:bg-white/10 dark:hover:bg-dark-700/50 transition-all"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
      >
        {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {open && (
        <button
          type="button"
          aria-label="Close menu"
          tabIndex={-1}
          className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          onClick={close}
        />
      )}

      <aside
        className={`h-dvh max-h-dvh w-64 bg-gray-100 dark:bg-dark-900 border-r border-gray-200 dark:border-dark-700 flex flex-col fixed left-0 top-0 z-50 transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-6 border-b border-gray-200 dark:border-dark-700 flex-shrink-0">
          <div className="flex items-center justify-between">
            <Logo />
            <ThemeToggle />
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto min-h-0" aria-label="Main">
          {NAV.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end ?? false}
              onClick={close}
              className={({ isActive }) =>
                `flex items-center p-3 rounded-xl transition-all group hover:bg-white/60 dark:hover:bg-dark-800/50 ${
                  isActive ? 'bg-white dark:bg-dark-700' : ''
                }`
              }
            >
              {({ isActive }) => (
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-lg">
                    <item.icon className="w-5 h-5 text-[#4F46E5]" />
                  </div>
                  <span
                    className={`font-medium ${
                      isActive
                        ? 'text-gray-800 dark:text-white'
                        : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-800 dark:group-hover:text-white'
                    }`}
                  >
                    {item.name}
                  </span>
                </div>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-dark-700 flex-shrink-0">
          <UserPanel />
        </div>
      </aside>
    </>
  );
}
