import type { EmailPrefs, Me } from '@pv/shared';
import { Bell } from 'lucide-react';
import toast from 'react-hot-toast';
import { Checkbox } from '../../components/ui/Field';
import { Card } from '../../components/ui/PageHeader';
import { useUpdateMe } from '../../lib/api/auth';
import { errorMessage } from '../../lib/errors';

const OPTIONS: { key: keyof EmailPrefs; label: string; description: string }[] = [
  {
    key: 'runCompleted',
    label: 'Scheduled report summaries',
    description: 'An email with the headline numbers each time a scheduled run finishes.',
  },
  {
    key: 'lowCredits',
    label: 'Low-credit warnings',
    description: 'At most once per billing period, when your balance runs low.',
  },
];

/** Opt-outs for non-essential email (10 § Opt-out). Each box saves on its own. */
export function EmailPrefsCard({ user }: { user: Me['user'] }) {
  const update = useUpdateMe();

  const toggle = (key: keyof EmailPrefs, on: boolean) =>
    update.mutate(
      { emailPrefs: { [key]: on } },
      {
        onSuccess: () => toast.success('Email preferences saved'),
        onError: (err) => toast.error(errorMessage(err)),
      },
    );

  return (
    <Card
      title={
        <span className="inline-flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary-500" aria-hidden /> Email notifications
        </span>
      }
    >
      <div className="space-y-4">
        {OPTIONS.map((o) => (
          <Checkbox
            key={o.key}
            checked={user.emailPrefs[o.key]}
            onChange={(on) => toggle(o.key, on)}
            disabled={update.isPending}
            label={o.label}
            description={o.description}
          />
        ))}
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Account, billing and schedule alerts (a skipped or paused schedule) are always sent.
        </p>
      </div>
    </Card>
  );
}
