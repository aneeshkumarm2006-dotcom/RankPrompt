import { zodResolver } from '@hookform/resolvers/zod';
import { registerBodySchema } from '@pv/shared';
import { ArrowRight, Gift } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Controller, useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Link, useSearchParams } from 'react-router';
import { z } from 'zod';
import { safeNext } from '../../app/RequireAuth';
import { Button } from '../../components/ui/Button';
import { Checkbox, Field, Input } from '../../components/ui/Field';
import { useGoogleSignIn, useRegister } from '../../lib/api/auth';
import { usePlans } from '../../lib/api/meta';
import { hasCode } from '../../lib/errors';
import { number } from '../../lib/format';
import { AuthLayout, authLinkClass, FormAlert } from './AuthLayout';
import { RedirectIfSignedIn } from '../../app/RequireAuth';
import { applyAuthError } from './authErrors';
import { GoogleButton } from './GoogleButton';
import { PasswordInput } from './PasswordInput';

/** Where a brand-new account starts: the add-brand wizard (09). */
const FIRST_RUN_PATH = '/app/brands/new';

/** The server's register schema (minus `ref`, which comes from the URL) plus the form-only fields. */
const registerFormSchema = registerBodySchema
  .omit({ ref: true })
  .extend({
    name: z.string().trim().min(1, 'Enter your name').max(100, 'Use at most 100 characters'),
    confirmPassword: z.string(),
    acceptTerms: z.boolean().refine(Boolean, 'Please accept the Terms and Privacy Policy'),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

/** `?ref=` as the server accepts it (max 64 chars); a bad code is ignored, never blocks signup. */
function readRef(raw: string | null): string | null {
  const ref = raw?.trim();
  return ref && ref.length <= 64 ? ref : null;
}

/** `/register` (F-02, F-04, F-05): email/password or Google, with the `?ref=` referral code. */
export function RegisterPage() {
  const [searchParams] = useSearchParams();
  const ref = readRef(searchParams.get('ref'));
  const registerUser = useRegister();
  const google = useGoogleSignIn();
  const { data: plans } = usePlans();
  const [alert, setAlert] = useState<ReactNode>(null);

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registerFormSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '', acceptTerms: false },
  });

  // A new account starts in the wizard; an already signed-in visitor goes to `?next=`/brands.
  const justRegistered = registerUser.isPending || registerUser.isSuccess;
  const destination = justRegistered ? FIRST_RUN_PATH : safeNext(searchParams.get('next'));

  const onSubmit = handleSubmit(async ({ name, email, password }) => {
    setAlert(null);
    try {
      await registerUser.mutateAsync({ name, email, password, ...(ref ? { ref } : {}) });
      toast.success('Account created! Check your inbox to verify your email.');
    } catch (err) {
      if (hasCode(err, 'CONFLICT')) {
        setAlert(
          <>
            An account with this email already exists.{' '}
            <Link to="/login" className="font-semibold underline underline-offset-2">
              Sign in instead
            </Link>
          </>,
        );
        return;
      }
      setAlert(applyAuthError(err, setError, ['name', 'email', 'password']));
    }
  });

  const onGoogle = (credential: string) => {
    setAlert(null);
    google.mutateAsync({ credential, ...(ref ? { ref } : {}) }).then(
      () => toast.success('Welcome to PromptVerse!'),
      (err: unknown) => setAlert(applyAuthError(err, setError, [])),
    );
  };

  const busy = isSubmitting || google.isPending;
  const signupBonus = plans?.grants.signupBonus ?? 0;
  const referralBonus = plans?.grants.referral ?? 0;

  return (
    <RedirectIfSignedIn to={destination}>
      <AuthLayout title="Create Account" subtitle="Start tracking your AI rankings today">
        {(signupBonus > 0 || ref) && (
          <div className="mb-6 p-4 rounded-xl bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/30 text-sm text-gray-700 dark:text-gray-300 space-y-1.5">
            {signupBonus > 0 && (
              <p className="flex items-center gap-2">
                <Gift className="w-4 h-4 text-purple-600 shrink-0" aria-hidden />
                <span>
                  Get <strong>{number(signupBonus)} free credits</strong> when you sign up.
                </span>
              </p>
            )}
            {ref && (
              <p data-testid="referral-note">
                <strong>Referred by a friend.</strong> Verify your email after signing up
                {referralBonus > 0
                  ? ` and they get ${number(referralBonus)} bonus credits.`
                  : ' to thank them.'}
              </p>
            )}
          </div>
        )}

        {alert && <FormAlert>{alert}</FormAlert>}

        <form onSubmit={(e) => void onSubmit(e)} className="space-y-5" noValidate>
          <Field label="Full name" error={errors.name?.message}>
            {(p) => (
              <Input
                {...p}
                {...register('name')}
                autoComplete="name"
                placeholder="Jane Doe"
                invalid={Boolean(errors.name)}
              />
            )}
          </Field>

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

          <Field label="Password" error={errors.password?.message}>
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

          <Field label="Confirm password" error={errors.confirmPassword?.message}>
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

          <div>
            <Controller
              control={control}
              name="acceptTerms"
              render={({ field }) => (
                <Checkbox
                  checked={field.value}
                  onChange={field.onChange}
                  label={
                    <span className="text-sm">
                      I agree to the{' '}
                      <Link to="/terms" className={authLinkClass}>
                        Terms of Service
                      </Link>{' '}
                      and{' '}
                      <Link to="/privacy" className={authLinkClass}>
                        Privacy Policy
                      </Link>
                    </span>
                  }
                />
              )}
            />
            {errors.acceptTerms && (
              <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
                {errors.acceptTerms.message}
              </p>
            )}
          </div>

          <Button type="submit" size="lg" loading={busy} className="w-full font-bold">
            {isSubmitting ? 'Creating account…' : 'Create Account'}
            {!busy && <ArrowRight className="w-5 h-5" aria-hidden />}
          </Button>
        </form>

        <GoogleButton
          text="signup_with"
          onCredential={onGoogle}
          onError={() => setAlert('Google sign-up failed. Please try again.')}
        />

        <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
          Already have an account?{' '}
          <Link to="/login" className={authLinkClass}>
            Sign in
          </Link>
        </p>
      </AuthLayout>
    </RedirectIfSignedIn>
  );
}
