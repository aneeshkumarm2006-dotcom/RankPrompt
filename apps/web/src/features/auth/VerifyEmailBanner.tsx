import { MailWarning } from 'lucide-react';
import toast from 'react-hot-toast';
import { useMe, useResendVerification } from '../../lib/api/auth';
import { toastError } from '../../lib/errors';

/** Nudge shown across the app until the email is verified (F-02; referral credit needs it, F-04). */
export function VerifyEmailBanner() {
  const { data: me } = useMe();
  const resend = useResendVerification();
  if (!me || me.user.emailVerified) return null;

  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-900/40 px-4 py-2.5 text-sm flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-yellow-900 dark:text-yellow-200">
      <MailWarning className="w-4 h-4 shrink-0" aria-hidden />
      <span>
        Please verify your email address. We sent a link to <strong>{me.user.email}</strong>.
      </span>
      <button
        type="button"
        className="font-semibold underline underline-offset-2 hover:no-underline disabled:opacity-50"
        disabled={resend.isPending || resend.isSuccess}
        onClick={() =>
          resend.mutate(undefined, {
            onSuccess: () => toast.success('Verification email sent'),
            onError: toastError,
          })
        }
      >
        {resend.isSuccess ? 'Sent' : 'Resend email'}
      </button>
    </div>
  );
}
