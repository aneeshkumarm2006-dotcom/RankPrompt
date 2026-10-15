import { KeyRound, Settings } from 'lucide-react';
import { ErrorState } from '../../components/ui/ErrorState';
import { Card, PageHeader } from '../../components/ui/PageHeader';
import { PageSpinner } from '../../components/ui/Spinner';
import { useMe } from '../../lib/api/auth';
import { EmailPrefsCard } from './EmailPrefsCard';
import { PasswordCard } from './PasswordCard';
import { PlanCard } from './PlanCard';
import { ProfileCard } from './ProfileCard';
import { SessionsCard } from './SessionsCard';

/** `/app/settings`: profile, plan summary, password, email preferences and sessions (F-28). */
export function SettingsPage() {
  const me = useMe();
  if (me.isPending) return <PageSpinner />;
  if (!me.data) return <ErrorState error={me.error} onRetry={() => void me.refetch()} />;
  const { user, workspace } = me.data;

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title="Account settings"
        description="Your profile, plan, password, emails and sessions."
        icon={<Settings className="w-8 h-8 text-primary-500" aria-hidden />}
      />
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <ProfileCard user={user} />
          <PlanCard workspace={workspace} />
        </div>
        {user.authMethods.includes('password') ? (
          <PasswordCard />
        ) : (
          <Card
            title={
              <span className="inline-flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-primary-500" aria-hidden /> Password
              </span>
            }
          >
            <p className="text-sm text-gray-600 dark:text-gray-300">
              You sign in with Google, so there’s no PromptVerse password to change. Manage your
              Google account’s security with Google.
            </p>
          </Card>
        )}
        <EmailPrefsCard user={user} />
        <SessionsCard />
      </div>
    </div>
  );
}
