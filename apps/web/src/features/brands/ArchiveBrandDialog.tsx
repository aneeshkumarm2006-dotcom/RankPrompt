import toast from 'react-hot-toast';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useArchiveBrand } from '../../lib/api/brands';
import { errorMessage } from '../../lib/errors';

/** Archive confirm (F-18): pauses schedules, keeps runs and reports, frees the plan slot. */
export function ArchiveBrandDialog({
  brand,
  onClose,
  onArchived,
}: {
  brand: { id: string; name: string } | null;
  onClose: () => void;
  onArchived?: () => void;
}) {
  const archive = useArchiveBrand();

  const confirm = () => {
    if (!brand) return;
    archive.mutate(brand.id, {
      onSuccess: () => {
        toast.success(`${brand.name} archived`);
        onClose();
        onArchived?.();
      },
      onError: (err) => toast.error(errorMessage(err)),
    });
  };

  return (
    <ConfirmDialog
      open={brand !== null}
      title="Archive brand"
      danger
      confirmLabel="Archive brand"
      loading={archive.isPending}
      onConfirm={confirm}
      onClose={onClose}
      message={
        <div className="space-y-2">
          <p>
            Archive <strong>{brand?.name}</strong>?
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Its scheduled runs are paused and it no longer counts towards your plan’s brand limit.
            Past runs and reports are kept.
          </p>
        </div>
      }
    />
  );
}
