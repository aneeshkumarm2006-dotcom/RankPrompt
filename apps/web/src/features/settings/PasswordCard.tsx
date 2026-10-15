import { zodResolver } from '@hookform/resolvers/zod';
import { changePasswordBodySchema } from '@pv/shared';
import { KeyRound } from 'lucide-react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { z } from 'zod';
import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Field';
import { Card } from '../../components/ui/PageHeader';
import { useChangePassword } from '../../lib/api/auth';
import { errorMessage, fieldErrors, hasCode } from '../../lib/errors';

export const passwordFormSchema = changePasswordBodySchema
  .extend({ confirmPassword: z.string() })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

const EMPTY = { currentPassword: '', newPassword: '', confirmPassword: '' };

/** Change password (F-28). The server signs every other session out. */
export function PasswordCard() {
  const change = useChangePassword();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(passwordFormSchema), defaultValues: EMPTY });

  const onSubmit = handleSubmit(({ currentPassword, newPassword }) =>
    change.mutateAsync({ currentPassword, newPassword }).then(
      () => {
        reset(EMPTY);
        toast.success('Password changed. Your other sessions were signed out.');
      },
      (err: unknown) => {
        if (hasCode(err, 'INVALID_CREDENTIALS')) {
          setError('currentPassword', { message: 'Your current password is incorrect' });
          return;
        }
        const fields = fieldErrors(err);
        if (fields.newPassword) setError('newPassword', { message: fields.newPassword });
        else toast.error(errorMessage(err));
      },
    ),
  );

  const field = (
    name: keyof typeof EMPTY,
    label: string,
    autoComplete: 'current-password' | 'new-password',
  ) => (
    <Field label={label} error={errors[name]?.message}>
      {(p) => (
        <Input
          {...p}
          {...register(name)}
          type="password"
          autoComplete={autoComplete}
          invalid={Boolean(errors[name])}
        />
      )}
    </Field>
  );

  return (
    <Card
      title={
        <span className="inline-flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-primary-500" aria-hidden /> Password
        </span>
      }
    >
      <form onSubmit={(e) => void onSubmit(e)} noValidate className="space-y-4">
        {field('currentPassword', 'Current password', 'current-password')}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {field('newPassword', 'New password', 'new-password')}
          {field('confirmPassword', 'Confirm new password', 'new-password')}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          At least 8 characters. Changing it signs you out on every other device.
        </p>
        <div className="flex justify-end">
          <Button type="submit" loading={change.isPending}>
            Change password
          </Button>
        </div>
      </form>
    </Card>
  );
}
