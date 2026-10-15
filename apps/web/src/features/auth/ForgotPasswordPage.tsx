import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordBodySchema } from '@pv/shared';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Field';
import { useForgotPassword } from '../../lib/api/auth';
import { AuthLayout, authLinkClass, FormAlert } from './AuthLayout';
import { applyAuthError } from './authErrors';

function BackToLogin() {
  return (
    <p className="mt-6 text-center text-sm">
      <Link to="/login" className={`inline-flex items-center gap-1.5 ${authLinkClass}`}>
        <ArrowLeft className="w-4 h-4" aria-hidden />
        Back to sign in
      </Link>
    </p>
  );
}

/**
 * `/forgot-password` (F-02). The server answers 204 for any email, so the page never says
 * whether an account exists.
 */
export function ForgotPasswordPage() {
  const forgot = useForgotPassword();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [alert, setAlert] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(forgotPasswordBodySchema), defaultValues: { email: '' } });

  const onSubmit = handleSubmit(async ({ email }) => {
    setAlert(null);
    try {
      await forgot.mutateAsync(email);
      setSentTo(email);
    } catch (err) {
      setAlert(applyAuthError(err, setError, ['email']));
    }
  });

  if (sentTo) {
    return (
      <AuthLayout title="Check your email">
        <div className="text-center space-y-4">
          <MailCheck className="w-14 h-14 text-green-500 mx-auto" aria-hidden />
          <p className="text-gray-600 dark:text-gray-300">
            If an account exists for <strong className="break-all">{sentTo}</strong>, we sent a link
            to reset your password. It may take a few minutes to arrive; check your spam folder too.
          </p>
        </div>
        <BackToLogin />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Forgot password?"
      subtitle="Enter your email and we’ll send you a link to reset it."
    >
      {alert && <FormAlert>{alert}</FormAlert>}
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-6" noValidate>
        <Field label="Email address" error={errors.email?.message}>
          {(p) => (
            <Input
              {...p}
              {...register('email')}
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              invalid={Boolean(errors.email)}
            />
          )}
        </Field>
        <Button type="submit" size="lg" loading={isSubmitting} className="w-full font-bold">
          {isSubmitting ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>
      <BackToLogin />
    </AuthLayout>
  );
}
