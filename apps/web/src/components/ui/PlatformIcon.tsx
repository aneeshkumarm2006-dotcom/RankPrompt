import { PLATFORM_LABELS, type Platform } from '@pv/shared';
import { faviconUrl } from '../../lib/format';

/** Favicon domain per platform (v1 used Google s2 favicons; CSP allows www.google.com). */
const PLATFORM_DOMAINS: Record<Platform, string> = {
  chatgpt: 'chatgpt.com',
  perplexity: 'perplexity.ai',
  gemini: 'gemini.google.com',
  claude: 'claude.ai',
  google_aio: 'google.com',
};

/** Chart colour per platform, the same everywhere (report, overview, PDF). */
export const PLATFORM_COLORS: Record<Platform, string> = {
  chatgpt: '#10a37f',
  perplexity: '#20808d',
  gemini: '#4285f4',
  claude: '#d97757',
  google_aio: '#ea4335',
};

/** Short names for tight spots (charts, table headers). */
export const PLATFORM_SHORT: Record<Platform, string> = {
  chatgpt: 'ChatGPT',
  perplexity: 'Perplexity',
  gemini: 'Gemini',
  claude: 'Claude',
  google_aio: 'Google AI',
};

export function PlatformIcon({ platform, size = 16 }: { platform: Platform; size?: number }) {
  return (
    <img
      src={faviconUrl(PLATFORM_DOMAINS[platform], 32)}
      alt=""
      aria-hidden
      width={size}
      height={size}
      className="shrink-0 rounded-sm"
      loading="lazy"
      onError={(e) => {
        e.currentTarget.style.visibility = 'hidden';
      }}
    />
  );
}

/** Icon plus label, as in v1's platform pickers. */
export function PlatformLabel({
  platform,
  short = false,
  className = '',
}: {
  platform: Platform;
  short?: boolean;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <PlatformIcon platform={platform} />
      <span>{short ? PLATFORM_SHORT[platform] : PLATFORM_LABELS[platform]}</span>
    </span>
  );
}
