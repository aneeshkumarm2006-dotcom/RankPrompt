import { AlertCircle, CheckCircle2, ExternalLink, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge, CheckStatusBadge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { PlatformLabel } from '../../components/ui/PlatformIcon';
import { rank } from '../../lib/format';
import { CitationList } from './CitationList';
import type { ReportCheck } from './viewModel';

function YesNo({ value }: { value: boolean }) {
  return value ? (
    <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
      <CheckCircle2 className="w-4 h-4" aria-hidden /> Yes
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
      <XCircle className="w-4 h-4" aria-hidden /> No
    </span>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
        {title}
      </h3>
      {children}
    </section>
  );
}

/**
 * Vendors in answer order. The brand and tracked competitors are marked by their server rank
 * (rank n is vendor n), so nothing is re-matched by name here.
 */
function VendorList({ check, brandName }: { check: ReportCheck; brandName: string }) {
  const vendors = check.vendors ?? [];
  if (vendors.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">No companies listed.</p>;
  }
  const marks = new Map<number, ReactNode>();
  for (const c of check.competitors) {
    if (c.rank !== null) marks.set(c.rank, <Badge tone="orange">Competitor: {c.name}</Badge>);
  }
  if (check.rank !== null) marks.set(check.rank, <Badge tone="purple">{brandName}</Badge>);
  return (
    <ol className="space-y-1">
      {vendors.map((v, i) => (
        <li key={`${i}-${v}`} className="flex items-center gap-2 text-sm">
          <span className="w-8 text-gray-400">{rank(i + 1)}</span>
          <span
            className={
              marks.has(i + 1)
                ? 'font-semibold text-gray-900 dark:text-white'
                : 'text-gray-700 dark:text-gray-300'
            }
          >
            {v}
          </span>
          {marks.get(i + 1)}
        </li>
      ))}
    </ol>
  );
}

/** One check in full: answer, snippet, citations, vendors and competitor results (F-13). */
export function AnswerModal({
  check,
  brand,
  onClose,
}: {
  check: ReportCheck | null;
  brand: { name: string; domain: string };
  onClose: () => void;
}) {
  if (!check) return null;
  return (
    <Modal open onClose={onClose} title="AI answer" size="xl">
      <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
        <div className="flex flex-wrap items-center gap-2">
          <PlatformLabel
            platform={check.platform}
            className="font-medium text-gray-800 dark:text-gray-200"
          />
          <CheckStatusBadge status={check.status} />
          <Badge>{check.category}</Badge>
        </div>
        <p className="break-words">
          <span className="font-medium text-gray-700 dark:text-gray-300">Prompt:</span>{' '}
          {check.prompt}
        </p>
      </div>

      {check.errorMessage && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300"
        >
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
          {check.errorMessage}
        </div>
      )}

      {check.status === 'ok' && (
        <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-xl bg-gray-100 dark:bg-dark-800 p-3">
            <dt className="text-xs text-gray-500 dark:text-gray-400">Mentioned</dt>
            <dd className="mt-1 font-medium">
              <YesNo value={check.mentioned} />
            </dd>
          </div>
          <div className="rounded-xl bg-gray-100 dark:bg-dark-800 p-3">
            <dt className="text-xs text-gray-500 dark:text-gray-400">Rank</dt>
            <dd className="mt-1 font-medium text-gray-800 dark:text-white">{rank(check.rank)}</dd>
          </div>
          <div className="rounded-xl bg-gray-100 dark:bg-dark-800 p-3">
            <dt className="text-xs text-gray-500 dark:text-gray-400">Cited</dt>
            <dd className="mt-1 font-medium">
              <YesNo value={check.cited} />
            </dd>
          </div>
        </dl>
      )}

      {check.snippet && (
        <Section title="Brand snippet">
          <blockquote className="rounded-xl border-l-4 border-action-500 bg-action-50 dark:bg-action-900/20 px-4 py-3 text-sm text-gray-800 dark:text-gray-200 whitespace-pre-line">
            {check.snippet}
          </blockquote>
          {check.citedUrl && (
            <a
              href={check.citedUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="mt-2 inline-flex items-center gap-1 text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400 underline"
            >
              <ExternalLink className="w-4 h-4" aria-hidden /> Open the cited page
            </a>
          )}
        </Section>
      )}

      <Section title="Answer">
        {check.answer ? (
          <div className="max-h-[45vh] overflow-y-auto rounded-xl bg-gray-50 dark:bg-dark-800 p-4">
            <p className="text-sm sm:text-base text-gray-700 dark:text-gray-200 whitespace-pre-wrap break-words leading-relaxed">
              {check.answer}
            </p>
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">No answer text.</p>
        )}
      </Section>

      <Section title="Citations">
        <CitationList citations={check.citations} brandDomain={brand.domain} />
      </Section>

      {check.vendors !== null && (
        <Section title="Companies in the answer">
          <VendorList check={check} brandName={brand.name} />
        </Section>
      )}

      {check.competitors.length > 0 && (
        <Section title="Competitors">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <th className="pb-2 font-medium">Competitor</th>
                <th className="pb-2 font-medium">Mentioned</th>
                <th className="pb-2 font-medium">Rank</th>
                <th className="pb-2 font-medium">Cited</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
              {check.competitors.map((c) => (
                <tr key={c.name}>
                  <td className="py-2 pr-2 text-gray-800 dark:text-gray-200">{c.name}</td>
                  <td className="py-2">
                    <YesNo value={c.mentioned} />
                  </td>
                  <td className="py-2 text-gray-800 dark:text-gray-200">{rank(c.rank)}</td>
                  <td className="py-2">
                    <YesNo value={c.cited} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}
    </Modal>
  );
}
