import type { Schedule } from '@pv/shared';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useDeleteSchedule } from '../../lib/api/schedules';
import { errorMessage } from '../../lib/errors';
import { ScheduleCard } from './ScheduleCard';
import { frequencySummary } from './scheduleText';

/** The brand's schedules, with delete behind a confirm (F-25). */
export function ScheduleList({
  brandId,
  schedules,
  readOnly,
  onEdit,
}: {
  brandId: string;
  schedules: Schedule[];
  readOnly: boolean;
  onEdit: (schedule: Schedule) => void;
}) {
  const [deleting, setDeleting] = useState<Schedule | null>(null);
  const remove = useDeleteSchedule(brandId);

  const confirmDelete = () => {
    if (!deleting) return;
    remove.mutate(deleting.id, {
      onSuccess: () => {
        toast.success('Schedule deleted');
        setDeleting(null);
      },
      onError: (err) => toast.error(errorMessage(err)),
    });
  };

  return (
    <div className="space-y-4">
      {schedules.map((s) => (
        <ScheduleCard
          key={s.id}
          schedule={s}
          readOnly={readOnly}
          onEdit={() => onEdit(s)}
          onDelete={() => setDeleting(s)}
        />
      ))}
      <ConfirmDialog
        open={deleting !== null}
        danger
        title="Delete schedule?"
        confirmLabel="Delete"
        loading={remove.isPending}
        message={
          <>
            <p>
              <strong>{deleting?.label || (deleting ? frequencySummary(deleting) : '')}</strong>{' '}
              will stop running. Past runs and their reports are kept.
            </p>
          </>
        }
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
