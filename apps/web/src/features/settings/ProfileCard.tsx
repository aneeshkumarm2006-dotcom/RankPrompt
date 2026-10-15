import { zodResolver } from '@hookform/resolvers/zod';
import type { Me } from '@pv/shared';
import { CheckCircle2, Mail, User } from 'lucide-react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { z } from 'zod';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Field';
import { Card } from '../../components/ui/PageHeader';
import { useResendVerification, useUpdateMe } from '../../lib/api/auth';
import { errorMessage, fieldErrors } from '../../lib/errors';

const nameSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name').max(100, 'Use at most 100 characters'),
});

/** Name (editable) and email with its verification state (F-28). */
export function ProfileCard({ user }: { user: Me['user'] }) {
  const update = useUpdateMe();
  const resend = useResendVerification();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty },
  } = useForm({ resolver: zodResolver(nameSchema), values: { name: user.name } });

  const onSubmit = handleSubmit(({ name }) =>
    update.mutateAsync({ name }).then(
      (me) => {
        reset({ name: me.user.name });
        toast.success('Profile updated');
      },
      (err: unknown) => {
        const fields = fieldErrors(err);
        if (fields.name) setError('name', { message: fields.name });
        else toast.error(errorMessage(err));
      },
    ),
  );

  const resendEmail = () =>
    resend.mutate(undefined, {
      onSuccess: () => toast.success(`Verification email sent to ${user.email}`),
      onError: (err) => toast.error(errorMessage(err)),
    });

  return (
    <Card
      title={
        <span className="inline-flex items-center gap-2">
          <User className="w-5 h-5 text-primary-500" aria-hidden /> Profile
        </span>
      }
    >
      <form onSubmit={(e) => void onSubmit(e)} noValidate className="space-y-5">
        <Field label="Name" error={errors.name?.message}>
          {(p) => (
            <Input
              {...p}
              {...register('name')}
              autoComplete="name"
              invalid={Boolean(errors.name)}
            />
          )}
        </Field>
        <div>
          <p className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email</p>
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 text-gray-800 dark:text-white break-all">
              <Mail className="w-4 h-4 text-gray-400" aria-hidden /> {user.email}
            </span>
            {user.emailVerified ? (
              <Badge tone="green">
                <CheckCircle2 className="w-3 h-3" aria-hidden /> Verified
              </Badge>
            ) : (
              <>
                <Badge tone="yellow">Not verified</Badge>
                <Button
                  size="sm"
                  variant="outline"
                  loading={resend.isPending}
                  onClick={resendEmail}
                >
                  Resend verification
                </Button>
              </>
            )}
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="submit" loading={update.isPending} disabled={!isDirty}>
            Save
          </Button>
        </div>
      </form>
    </Card>
  );
}
