import { CheckCircle2, MailWarning } from 'lucide-react';
import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { Link, useSearchParams } from 'react-router';
import { Button, buttonClass } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { useMe, useResendVerification, useVerifyEmail } from '../../lib/api/auth';
import { toastError } from '../../lib/errors';
import { AuthLayout } from './AuthLayout';

/** Link sent to a signed-in user (or one who must sign in first). */
function ContinueLink() {
  const { data: me } = useMe();
  return (
    <Link
      to={me ? '/app/brands' : '/login'}
      className={`${buttonClass('primary', 'lg')} w-full font-bold`}
    >
      {me ? 'Go to the app' : 'Sign in'}
    </Link>
  );
}

function ResendButton() {
  const { data: me } = useMe();
  const resend = useResendVerification();
  if (!me || me.user.emailVerified) return null;
  return (
    <Button
      variant="outline"
      size="lg"
      className="w-full"
      loading={resend.isPending}
      disabled={resend.isSuccess}
      onClick={() =>
        resend.mutate(undefined, {
          onSuccess: () => toast.success('Verification email sent'),
          onError: toastError,
        })
      }
    >
      {resend.isSuccess ? 'Email sent' : 'Send a new link'}
    </Button>
  );
}

/** `/verify-email?token=` (F-02): verifies once on arrival and shows the outcome. */
export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const verify = useVerifyEmail();
  const { mutate } = verify;
  const started = useRef(false);

  useEffect(() => {
    // Once per page load: the token is single-use, and StrictMode runs effects twice.
    if (!token || started.current) return;
    started.current = true;
    mutate(token);
  }, [token, mutate]);

  if (token && (verify.isIdle || verify.isPending)) {
    return (
      <AuthLayout title="Verifying your email">
        <div className="py-6">
          <Spinner size="lg" label="Just a moment…" />
        </div>
      </AuthLayout>
    );
  }

  if (verify.isSuccess) {
    return (
      <AuthLayout title="Email verified">
        <div className="text-center space-y-6">
          <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto" aria-hidden />
          <p className="text-gray-600 dark:text-gray-300">
            Thanks! Your email address is confirmed and your account is fully set up.
          </p>
          <ContinueLink />
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="This link doesn’t work">
      <div className="text-center space-y-6">
        <MailWarning className="w-14 h-14 text-yellow-500 mx-auto" aria-hidden />
        <p className="text-gray-600 dark:text-gray-300">
          The verification link is invalid, has expired or was already used. If your email isn’t
          verified yet, sign in and request a new link.
        </p>
        <div className="space-y-3">
          <ResendButton />
          <ContinueLink />
        </div>
      </div>
    </AuthLayout>
  );
}
