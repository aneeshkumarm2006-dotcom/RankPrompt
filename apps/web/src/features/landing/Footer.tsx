import { Link } from 'react-router';
import { BrandLogo } from './BrandLogo';

const linkClass =
  'text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-primary-400 transition-colors';

/**
 * v1 Footer. Its placeholder links (API, Careers, social icons, …) all pointed at `#`; only real
 * destinations are kept, and Terms/Privacy now exist (they 404'd in v1).
 */
export function Footer({ onLanding = true }: { onLanding?: boolean }) {
  const section = (id: string) => (onLanding ? `#${id}` : `/#${id}`);

  return (
    <footer className="bg-gray-50 dark:bg-dark-950 border-t border-gray-200 dark:border-dark-700 py-12 sm:py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 sm:gap-10 md:gap-12 mb-8 sm:mb-12">
          <div className="space-y-4 sm:space-y-6 sm:col-span-2">
            <BrandLogo />
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed max-w-sm">
              Monitor and improve your brand&apos;s visibility across AI search platforms like
              ChatGPT, Gemini, Claude, Perplexity and Google AI Overviews.
            </p>
          </div>

          <div>
            <h2 className="text-gray-800 dark:text-white font-bold mb-4 sm:mb-6 text-base sm:text-lg">
              Product
            </h2>
            <ul className="space-y-2 sm:space-y-3 text-sm">
              <li>
                <a href={section('features')} className={linkClass}>
                  Features
                </a>
              </li>
              <li>
                <a href={section('how-it-works')} className={linkClass}>
                  How It Works
                </a>
              </li>
              <li>
                <a href={section('pricing')} className={linkClass}>
                  Pricing
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-gray-800 dark:text-white font-bold mb-4 sm:mb-6 text-base sm:text-lg">
              Account
            </h2>
            <ul className="space-y-2 sm:space-y-3 text-sm">
              <li>
                <Link to="/login" className={linkClass}>
                  Sign In
                </Link>
              </li>
              <li>
                <Link to="/register" className={linkClass}>
                  Create Account
                </Link>
              </li>
              <li>
                <Link to="/forgot-password" className={linkClass}>
                  Reset Password
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-dark-700 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            © {new Date().getFullYear()} PromptVerse. Built for better AI search visibility.
          </p>
          <div className="flex space-x-6 text-sm">
            <Link to="/privacy" className={linkClass}>
              Privacy Policy
            </Link>
            <Link to="/terms" className={linkClass}>
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
