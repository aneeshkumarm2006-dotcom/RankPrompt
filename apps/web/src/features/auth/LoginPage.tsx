import { zodResolver } from '@hookform/resolvers/zod';
import { loginBodySchema } from '@pv/shared';
import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Link, useSearchParams } from 'react-router';
import { z } from 'zod';
import { safeNext } from '../../app/RequireAuth';
import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Field';
import { useGoogleSignIn, useLogin } from '../../lib/api/auth';
import { AuthLayout, authLinkClass, FormAlert } from './AuthLayout';
import { RedirectIfSignedIn } from '../../app/RequireAuth';
import { applyAuthError } from './authErrors';
import { GoogleButton } from './GoogleButton';
import { PasswordInput } from './PasswordInput';

/** The server's login schema, with a friendlier "required" message for the password. */
const loginFormSchema = loginBodySchema.extend({
  password: z.string().min(1, 'Enter your password').max(1024),
});

/** `/login` (F-02, F-03). After sign-in goes to `?next=` (same-app paths only) or the brands list. */
export function LoginPage() {
  const [searchParams] = useSearchParams();
  const destination = safeNext(searchParams.get('next'));
  const login = useLogin();
  const google = useGoogleSignIn();
  const [alert, setAlert] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (body) => {
    setAlert(null);
    try {
      await login.mutateAsync(body);
      toast.success('Welcome back!');
      // RedirectIfSignedIn redirects to `destination` now that `me` is set.
    } catch (err) {
      setAlert(applyAuthError(err, setError, ['email', 'password']));
    }
  });

  const onGoogle = (credential: string) => {
    setAlert(null);
    google.mutateAsync({ credential }).then(
      () => toast.success('Welcome back!'),
      (err: unknown) => setAlert(applyAuthError(err, setError, [])),
    );
  };

  const busy = isSubmitting || google.isPending;

  return (
    <RedirectIfSignedIn to={destination}>
      <AuthLayout title="Welcome Back" subtitle="Sign in to your account">
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

          <div>
            <Field label="Password" error={errors.password?.message}>
              {(p) => (
                <PasswordInput
                  {...p}
                  {...register('password')}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  invalid={Boolean(errors.password)}
                />
              )}
            </Field>
            <div className="mt-2 flex justify-end">
              <Link to="/forgot-password" className={`text-sm ${authLinkClass}`}>
                Forgot password?
              </Link>
            </div>
          </div>

          <Button type="submit" size="lg" loading={busy} className="w-full font-bold">
            {isSubmitting ? 'Signing in…' : 'Sign In'}
            {!busy && <ArrowRight className="w-5 h-5" aria-hidden />}
          </Button>
        </form>

        <GoogleButton
          text="continue_with"
          onCredential={onGoogle}
          onError={() => setAlert('Google sign-in failed. Please try again.')}
        />

        <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
          Don&apos;t have an account?{' '}
          <Link to="/register" className={authLinkClass}>
            Sign up for free
          </Link>
        </p>
      </AuthLayout>
    </RedirectIfSignedIn>
  );
}
