import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { ThemeToggle } from '../../app/theme/ThemeToggle';
import { useMe } from '../../lib/api/auth';
import { BrandLogo } from './BrandLogo';

/** Section anchors: on the landing page they scroll; elsewhere (legal pages) they go home first. */
const SECTIONS = [
  { id: 'features', label: 'Features' },
  { id: 'how-it-works', label: 'How It Works' },
  { id: 'pricing', label: 'Pricing' },
] as const;

const desktopLink =
  'px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-action-500 dark:hover:text-action-400 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-dark-800';
const mobileLink =
  'block px-4 py-3 text-gray-600 dark:text-gray-300 hover:text-action-500 dark:hover:text-action-400 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-lg transition-colors';

/** v1 landing Navbar. Signed in → "Go to app"; signed out → Sign In / Get Started Free. */
export function Navbar({ onLanding = true }: { onLanding?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const { data: me } = useMe();
  const close = () => setIsOpen(false);
  const sectionHref = (id: string) => (onLanding ? `#${id}` : `/#${id}`);

  return (
    <nav
      aria-label="Main"
      className="fixed w-full z-50 bg-white dark:bg-dark-900 border-b border-gray-200 dark:border-dark-700 shadow-sm"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <BrandLogo />

          <div className="hidden md:flex items-center space-x-1">
            {SECTIONS.map((s) => (
              <a key={s.id} href={sectionHref(s.id)} className={desktopLink}>
                {s.label}
              </a>
            ))}
            <ThemeToggle />
            {me ? (
              <Link
                to="/app/brands"
                className="ml-4 bg-action-600 text-white px-6 py-2.5 rounded-full font-semibold hover:bg-action-700 transition-all duration-300"
              >
                Go to app
              </Link>
            ) : (
              <>
                <Link to="/login" className={`${desktopLink} ml-4`}>
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="ml-2 bg-action-600 text-white px-6 py-2.5 rounded-full font-semibold hover:bg-action-700 transition-all duration-300"
                >
                  Get Started Free
                </Link>
              </>
            )}
          </div>

          <div className="md:hidden flex items-center">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              aria-label={isOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isOpen}
              className="text-gray-600 dark:text-gray-300 hover:text-action-500 dark:hover:text-action-400 p-2 ml-2"
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {isOpen && (
          <div className="md:hidden py-4 space-y-2 border-t border-gray-200 dark:border-dark-700 animate-slide-down bg-white dark:bg-dark-900">
            {SECTIONS.map((s) => (
              <a key={s.id} href={sectionHref(s.id)} onClick={close} className={mobileLink}>
                {s.label}
              </a>
            ))}
            {me ? (
              <Link
                to="/app/brands"
                onClick={close}
                className="block w-full bg-action-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-action-700 transition-all mt-2 text-center"
              >
                Go to app
              </Link>
            ) : (
              <>
                <Link to="/login" onClick={close} className={mobileLink}>
                  Sign In
                </Link>
                <Link
                  to="/register"
                  onClick={close}
                  className="block w-full bg-action-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-action-700 transition-all mt-2 text-center"
                >
                  Get Started Free
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
