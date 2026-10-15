import type { CreatedShare, Share } from '@pv/shared';
import { Check, Copy, Link2 } from 'lucide-react';
import { useId, useState } from 'react';
import toast from 'react-hot-toast';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ErrorState } from '../../components/ui/ErrorState';
import { Modal } from '../../components/ui/Modal';
import { Spinner } from '../../components/ui/Spinner';
import { useCreateShare, useRevokeShare, useShares } from '../../lib/api/shares';
import { toastError } from '../../lib/errors';
import { formatDate, formatDateTime, pluralize } from '../../lib/format';

const EXPIRY_OPTIONS = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: 'never', label: 'Never' },
] as const;

function shareState(share: Share, now: number): { tone: 'green' | 'gray' | 'red'; label: string } {
  if (share.revokedAt) return { tone: 'red', label: 'Revoked' };
  if (share.expiresAt && new Date(share.expiresAt).getTime() <= now) {
    return { tone: 'gray', label: 'Expired' };
  }
  return { tone: 'green', label: 'Active' };
}

function CreatedLink({ share }: { share: CreatedShare }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(share.url);
      setCopied(true);
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy. Select the link and copy it yourself.');
    }
  };
  return (
    <div className="rounded-xl border border-green-200 dark:border-green-900/50 bg-green-50 dark:bg-green-900/20 p-4">
      <p className="text-sm text-green-800 dark:text-green-300 mb-2">
        Your link is ready. Copy it now: for security it is only shown once.
      </p>
      <div className="flex gap-2">
        <input
          readOnly
          aria-label="Share link"
          value={share.url}
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 min-w-0 rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-800 px-3 py-2 text-sm text-gray-800 dark:text-gray-200"
        />
        <Button
          size="sm"
          onClick={() => void copy()}
          icon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        {share.expiresAt ? `Expires ${formatDate(share.expiresAt)}.` : 'Never expires.'} Anyone with
        the link can view this report.
      </p>
    </div>
  );
}

/** Create, copy and revoke public links to a finished run (F-14). */
export function ShareModal({
  runId,
  open,
  onClose,
}: {
  runId: string;
  open: boolean;
  onClose: () => void;
}) {
  const id = useId();
  const [expiry, setExpiry] = useState<string>('30');
  const [created, setCreated] = useState<CreatedShare | null>(null);
  const shares = useShares(runId, open);
  const create = useCreateShare(runId);
  const revoke = useRevokeShare(runId);
  const [now] = useState(() => Date.now());

  const onCreate = () => {
    create.mutate(expiry === 'never' ? undefined : Number(expiry), {
      onSuccess: setCreated,
      onError: toastError,
    });
  };

  const close = () => {
    setCreated(null);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Share report"
      size="lg"
      icon={<Link2 className="w-6 h-6 text-action-500" aria-hidden />}
    >
      <div className="space-y-6">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Anyone with a link can view this report without signing in. Search engines are asked not
            to index it, and you can revoke a link at any time.
          </p>
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1">
              <label
                htmlFor={`${id}-expiry`}
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Link expires after
              </label>
              <select
                id={`${id}-expiry`}
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-800 px-3 py-2 text-sm text-gray-800 dark:text-gray-200"
              >
                {EXPIRY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={onCreate} loading={create.isPending}>
              Create link
            </Button>
          </div>
        </div>

        {created && <CreatedLink share={created} />}

        <div>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-white mb-2">Links</h3>
          {shares.isPending ? (
            <Spinner size="sm" />
          ) : shares.isError ? (
            <ErrorState error={shares.error} onRetry={() => void shares.refetch()} />
          ) : shares.data.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No links yet.</p>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-dark-700">
              {shares.data.map((s) => {
                const state = shareState(s, now);
                return (
                  <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
                    <Badge tone={state.tone}>{state.label}</Badge>
                    <div className="flex-1 min-w-0 text-sm">
                      <div className="text-gray-800 dark:text-gray-200">
                        Created {formatDateTime(s.createdAt)}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {pluralize(s.viewCount, 'view')}
                        {s.lastViewedAt && ` · last ${formatDate(s.lastViewedAt)}`}
                        {' · '}
                        {s.revokedAt
                          ? `revoked ${formatDate(s.revokedAt)}`
                          : s.expiresAt
                            ? `expires ${formatDate(s.expiresAt)}`
                            : 'never expires'}
                      </div>
                    </div>
                    {!s.revokedAt && (
                      <Button
                        variant="outline"
                        size="sm"
                        loading={revoke.isPending && revoke.variables === s.id}
                        onClick={() =>
                          revoke.mutate(s.id, {
                            onSuccess: () => toast.success('Link revoked'),
                            onError: toastError,
                          })
                        }
                      >
                        Revoke
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
