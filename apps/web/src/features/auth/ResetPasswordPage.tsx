import { zodResolver } from '@hookform/resolvers/zod';
import { passwordSchema } from '@pv/shared';
import { KeyRound } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import { Button, buttonClass } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { useResetPassword } from '../../lib/api/auth';
import { fieldErrors, hasCode } from '../../lib/errors';
import { AuthLayout, FormAlert } from './AuthLayout';
import { applyAuthError } from './authErrors';
import { PasswordInput } from './PasswordInput';

const resetFormSchema = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

function InvalidLink() {
  return (
    <AuthLayout title="This link doesn’t work">
      <div className="text-center space-y-6">
        <KeyRound className="w-14 h-14 text-yellow-500 mx-auto" aria-hidden />
        <p className="text-gray-600 dark:text-gray-300">
          The reset link is invalid, has expired or was already used. Request a new one and use the
          latest email we send.
        </p>
        <Link to="/forgot-password" className={`${buttonClass('primary', 'lg')} w-full font-bold`}>
          Request a new link
        </Link>
      </div>
    </AuthLayout>
  );
}

/** `/reset-password?token=` (F-02): choose a new password, then sign in with it. */
export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const navigate = useNavigate();
  const reset = useResetPassword();
  const [alert, setAlert] = useState<string | null>(null);
  const [tokenRejected, setTokenRejected] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(resetFormSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async ({ password }) => {
    setAlert(null);
    try {
      await reset.mutateAsync({ token, password });
      toast.success('Password updated. Sign in with your new password.');
      void navigate('/login', { replace: true });
    } catch (err) {
      // A bad, expired or used token is a VALIDATION_FAILED without field details (or with a
      // `token` issue when it is malformed); password issues come back on `password`.
      const issues = fieldErrors(err);
      const badToken =
        hasCode(err, 'VALIDATION_FAILED') && (Boolean(issues.token) || !issues.password);
      if (badToken || hasCode(err, 'NOT_FOUND')) {
        setTokenRejected(true);
        return;
      }
      setAlert(applyAuthError(err, setError, ['password']));
    }
  });

  if (!token || tokenRejected) return <InvalidLink />;

  return (
    <AuthLayout title="Set a new password" subtitle="Choose a password you don’t use elsewhere.">
      {alert && <FormAlert>{alert}</FormAlert>}
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-6" noValidate>
        <Field label="New password" error={errors.password?.message}>
          {(p) => (
            <PasswordInput
              {...p}
              {...register('password')}
              autoComplete="new-password"
              placeholder="••••••••"
              invalid={Boolean(errors.password)}
            />
          )}
        </Field>
        <Field label="Confirm new password" error={errors.confirmPassword?.message}>
          {(p) => (
            <PasswordInput
              {...p}
              {...register('confirmPassword')}
              autoComplete="new-password"
              placeholder="••••••••"
              invalid={Boolean(errors.confirmPassword)}
            />
          )}
        </Field>
        <Button type="submit" size="lg" loading={isSubmitting} className="w-full font-bold">
          {isSubmitting ? 'Saving…' : 'Update password'}
        </Button>
      </form>
    </AuthLayout>
  );
}
