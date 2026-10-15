import { CalendarClock, FileDown, FileSpreadsheet, Share2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useNavigate } from 'react-router';
import { Button, buttonClass } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { runExportUrl, useDeleteRun } from '../../lib/api/runs';
import { errorMessage, hasCode } from '../../lib/errors';
import { ShareModal } from './ShareModal';
import type { ReportViewModel } from './viewModel';

/** Owner actions on a finished run: share, PDF, XLSX, schedule this setup, delete (09). */
export function ReportActions({
  runId,
  brandId,
  report,
}: {
  runId: string;
  brandId: string;
  report: ReportViewModel;
}) {
  const navigate = useNavigate();
  const [sharing, setSharing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [exporting, setExporting] = useState(false);
  const deleteRun = useDeleteRun();

  const exportPdf = async () => {
    setExporting(true);
    try {
      const { generateReportPdf } = await import('./pdf/generateReportPdf');
      await generateReportPdf(report);
      toast.success('PDF downloaded');
    } catch {
      toast.error('Could not create the PDF. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const onDelete = () => {
    deleteRun.mutate(runId, {
      onSuccess: () => {
        toast.success('Run deleted');
        void navigate('/app/runs', { replace: true });
      },
      onError: (err) => {
        setConfirmDelete(false);
        toast.error(
          hasCode(err, 'RUN_NOT_FINAL')
            ? 'This run is still going. You can delete it once it finishes.'
            : errorMessage(err),
        );
      },
    });
  };

  return (
    <>
      <Button
        variant="primary"
        size="sm"
        icon={<Share2 className="w-4 h-4" />}
        onClick={() => setSharing(true)}
      >
        Share
      </Button>
      <Button
        variant="secondary"
        size="sm"
        loading={exporting}
        icon={<FileDown className="w-4 h-4" />}
        onClick={() => void exportPdf()}
      >
        PDF
      </Button>
      <a href={runExportUrl(runId)} download className={buttonClass('secondary', 'sm')}>
        <FileSpreadsheet className="w-4 h-4" aria-hidden />
        XLSX
      </a>
      <Link
        to={`/app/brands/${brandId}/schedules?fromRun=${runId}`}
        className={buttonClass('outline', 'sm')}
      >
        <CalendarClock className="w-4 h-4" aria-hidden />
        Schedule this setup
      </Link>
      <Button
        variant="ghost"
        size="sm"
        aria-label="Delete run"
        icon={<Trash2 className="w-4 h-4 text-red-500" />}
        onClick={() => setConfirmDelete(true)}
      />

      <ShareModal runId={runId} open={sharing} onClose={() => setSharing(false)} />
      <ConfirmDialog
        open={confirmDelete}
        title="Delete this run?"
        message="The report, its results and any share links will be deleted. This cannot be undone."
        confirmLabel="Delete run"
        danger
        loading={deleteRun.isPending}
        onConfirm={onDelete}
        onClose={() => setConfirmDelete(false)}
      />
    </>
  );
}
