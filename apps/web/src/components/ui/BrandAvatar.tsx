import { useState } from 'react';
import { faviconUrl } from '../../lib/format';

const SIZES = { sm: 'w-8 h-8 text-sm', md: 'w-10 h-10', lg: 'w-12 h-12 text-lg' } as const;

/** Brand favicon from Google s2 (D-013), falling back to the initial as in v1. */
export function BrandAvatar({
  name,
  domain,
  size = 'md',
}: {
  name: string;
  domain?: string | null | undefined;
  size?: keyof typeof SIZES;
}) {
  const [failed, setFailed] = useState(false);
  if (domain && !failed) {
    return (
      <img
        src={faviconUrl(domain, 64)}
        alt=""
        aria-hidden
        className={`${SIZES[size]} rounded-lg shrink-0 bg-white object-contain p-1 border border-gray-200 dark:border-dark-700`}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div
      aria-hidden
      className={`${SIZES[size]} rounded-lg shrink-0 bg-primary-500 dark:bg-primary-600 flex items-center justify-center text-white font-bold`}
    >
      {name.charAt(0).toUpperCase() || 'B'}
    </div>
  );
}
