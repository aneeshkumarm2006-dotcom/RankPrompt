import type { SourcesResponse } from '@pv/shared';
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { Fragment, useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { PlatformIcon, PLATFORM_SHORT } from '../../components/ui/PlatformIcon';
import { faviconUrl, number, pct, prettyUrl } from '../../lib/format';

type Domain = SourcesResponse['domains'][number];

const TH =
  'px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider';

function SampleDetails({ domain }: { domain: Domain }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
      <div>
        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
          Sample URLs
        </h4>
        {domain.sampleUrls.length === 0 ? (
          <p className="text-gray-400">—</p>
        ) : (
          <ul className="space-y-1">
            {domain.sampleUrls.map((url) => (
              <li key={url}>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-action-600 hover:text-action-700 dark:text-action-400 break-all"
                >
                  {prettyUrl(url)}
                  <ExternalLink className="w-3 h-3 shrink-0" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
          Cited for prompts
        </h4>
        {domain.samplePrompts.length === 0 ? (
          <p className="text-gray-400">—</p>
        ) : (
          <ul className="space-y-1 list-disc pl-4 text-gray-700 dark:text-gray-300">
            {domain.samplePrompts.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Cited domains with share of all citations (F-24), expandable to sample URLs and prompts. */
export function SourcesTable({ domains }: { domains: Domain[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-dark-900">
          <tr>
            <th scope="col" className={TH}>
              #
            </th>
            <th scope="col" className={TH}>
              Domain
            </th>
            <th scope="col" className={TH}>
              Citations
            </th>
            <th scope="col" className={TH}>
              Share
            </th>
            <th scope="col" className={TH}>
              Platforms
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
          {domains.map((d, i) => {
            const expanded = open === d.domain;
            return (
              <Fragment key={d.domain}>
                <tr className={d.isBrand ? 'bg-action-50/60 dark:bg-action-900/20' : ''}>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{i + 1}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setOpen(expanded ? null : d.domain)}
                      aria-expanded={expanded}
                      className="inline-flex items-center gap-2 text-left text-gray-800 dark:text-gray-200 hover:text-action-600"
                    >
                      {expanded ? (
                        <ChevronDown className="w-4 h-4 text-gray-400" aria-hidden />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400" aria-hidden />
                      )}
                      <img
                        src={faviconUrl(d.domain, 32)}
                        alt=""
                        aria-hidden
                        width={16}
                        height={16}
                      />
                      <span className="font-medium">{d.domain}</span>
                    </button>
                    {d.isBrand && (
                      <Badge tone="purple" className="ml-2">
                        Your site
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-800 dark:text-white">
                    {number(d.count)}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{pct(d.share, 1)}</td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5">
                      {d.platforms.map((p) => (
                        <span key={p} title={PLATFORM_SHORT[p]}>
                          <PlatformIcon platform={p} />
                          <span className="sr-only">{PLATFORM_SHORT[p]}</span>
                        </span>
                      ))}
                    </span>
                  </td>
                </tr>
                {expanded && (
                  <tr>
                    <td colSpan={5} className="px-4 py-4 bg-gray-50 dark:bg-dark-900">
                      <SampleDetails domain={d} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
