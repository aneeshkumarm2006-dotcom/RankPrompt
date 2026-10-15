import { LogOut, MonitorSmartphone } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Card } from '../../components/ui/PageHeader';
import { useLogoutEverywhere } from '../../lib/api/auth';
import { errorMessage } from '../../lib/errors';

/** "Sign out everywhere" (F-28): revokes every session, this one included. */
export function SessionsCard() {
  const [confirming, setConfirming] = useState(false);
  const logoutAll = useLogoutEverywhere();
  const navigate = useNavigate();

  const signOutEverywhere = () =>
    logoutAll.mutate(undefined, {
      onSuccess: () => {
        toast.success('Signed out on every device');
        void navigate('/login', { replace: true });
      },
      onError: (err) => toast.error(errorMessage(err)),
    });

  return (
    <Card
      title={
        <span className="inline-flex items-center gap-2">
          <MonitorSmartphone className="w-5 h-5 text-primary-500" aria-hidden /> Sessions
        </span>
      }
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Lost a device or signed in somewhere public? Sign out of PromptVerse everywhere, including
          this browser.
        </p>
        <Button
          variant="danger"
          className="shrink-0"
          icon={<LogOut className="w-4 h-4" />}
          onClick={() => setConfirming(true)}
        >
          Sign out everywhere
        </Button>
      </div>
      <ConfirmDialog
        open={confirming}
        danger
        title="Sign out everywhere?"
        message="Every session, on every device, will be signed out. You’ll need to sign in again here too."
        confirmLabel="Sign out everywhere"
        loading={logoutAll.isPending}
        onConfirm={signOutEverywhere}
        onClose={() => setConfirming(false)}
      />
    </Card>
  );
}
