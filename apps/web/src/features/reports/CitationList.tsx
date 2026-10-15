import { ExternalLink } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { faviconUrl, prettyUrl } from '../../lib/format';
import { isBrandDomain, type ReportCitation } from './viewModel';

/** Citations of one answer, in order; the brand's own pages are highlighted. */
export function CitationList({
  citations,
  brandDomain,
}: {
  citations: ReportCitation[];
  brandDomain: string;
}) {
  if (citations.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">No citations in this answer.</p>;
  }
  return (
    <ol className="space-y-2">
      {citations.map((c, i) => {
        const own = isBrandDomain(c.domain, brandDomain);
        return (
          <li
            key={`${i}-${c.url}`}
            className={`flex items-start gap-3 rounded-xl border px-3 py-2 ${
              own
                ? 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                : 'border-gray-200 dark:border-dark-700'
            }`}
          >
            <span className="w-5 shrink-0 pt-0.5 text-xs text-gray-400">{i + 1}.</span>
            <img
              src={faviconUrl(c.domain, 32)}
              alt=""
              aria-hidden
              width={16}
              height={16}
              className="mt-0.5 shrink-0 rounded-sm"
              loading="lazy"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200 break-words">
                  {c.title || c.domain}
                </span>
                {own && <Badge tone="green">Your site</Badge>}
              </div>
              <a
                href={c.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 underline break-all"
              >
                {prettyUrl(c.url)}
                <ExternalLink className="w-3 h-3 shrink-0" aria-hidden />
              </a>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
