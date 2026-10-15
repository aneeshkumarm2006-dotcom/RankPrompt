import { Link } from 'react-router';
import { buttonClass } from '../components/ui/Button';
import { useMe } from '../lib/api/auth';

/** v1 silently redirected unknown paths to `/`; v2 shows a real 404 (09 § Routes). */
export function NotFoundPage() {
  const { data: me } = useMe();
  return (
    <section className="min-h-[70vh] flex flex-col items-center justify-center text-center px-6 py-20">
      <p className="text-6xl font-bold gradient-text mb-4">404</p>
      <h1 className="text-2xl font-semibold text-gray-800 dark:text-white mb-2">Page not found</h1>
      <p className="text-gray-500 dark:text-gray-400 mb-8">
        The page you’re looking for doesn’t exist or has moved.
      </p>
      <Link to={me ? '/app/brands' : '/'} className={buttonClass('primary', 'lg')}>
        {me ? 'Back to my brands' : 'Go home'}
      </Link>
    </section>
  );
}
