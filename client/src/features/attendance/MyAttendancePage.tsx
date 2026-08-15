import { useState } from 'react';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import { DatePicker } from '@/components/ui/DatePicker';
import { Modal } from '@/components/ui/Modal';
import { ModalCancelAction, ModalSendAction } from '@/components/ui/ModalActions';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/Toast';
import {
  useLogAttendance,
  useMyAttendanceCorrections,
  useMyAttendanceRecords,
  useRequestAttendanceCorrection,
} from '@/features/attendance/api';
import { ApiError } from '@/lib/apiClient';
import type { AttendanceRecord } from '@/types/api';

function actionError(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  const dateOnly = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return dateOnly ? dateOnly[1] : value;
}

function formatTime(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function CorrectionButton({ record, onSubmitted }: { record: AttendanceRecord; onSubmitted: () => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ requested_check_in_at: '', requested_check_out_at: '', reason: '' });
  const correctionMutation = useRequestAttendanceCorrection();

  async function handleSubmit() {
    if (!form.reason.trim()) return;
    try {
      await correctionMutation.mutateAsync({
        attendance_record_id: record.id,
        requested_check_in_at: form.requested_check_in_at || undefined,
        requested_check_out_at: form.requested_check_out_at || undefined,
        reason: form.reason,
      });
      setOpen(false);
      setForm({ requested_check_in_at: '', requested_check_out_at: '', reason: '' });
      toast.success('Correction requested', 'Your request has been sent for review.');
      onSubmitted();
    } catch (error) {
      toast.error('Could not submit correction', actionError(error, 'Could not submit this correction request.'));
    }
  }

  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Request correction
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Request attendance correction"
        footer={
          <>
            <ModalCancelAction onClick={() => setOpen(false)} />
            <ModalSendAction title="Submit request" isLoading={correctionMutation.isPending} disabled={!form.reason.trim()} onClick={handleSubmit} />
          </>
        }
      >
        <div className="space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">Corrected check-in</span>
            <input
              type="datetime-local"
              value={form.requested_check_in_at}
              onChange={(event) => setForm((current) => ({ ...current, requested_check_in_at: event.target.value }))}
              className="h-9 w-full rounded-md border border-border bg-white px-3 text-sm text-strong focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">Corrected check-out</span>
            <input
              type="datetime-local"
              value={form.requested_check_out_at}
              onChange={(event) => setForm((current) => ({ ...current, requested_check_out_at: event.target.value }))}
              className="h-9 w-full rounded-md border border-border bg-white px-3 text-sm text-strong focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">Reason</span>
            <Textarea value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} required />
          </label>
        </div>
      </Modal>
    </>
  );
}

function MyAttendanceContent() {
  const toast = useToast();
  const recordsQuery = useMyAttendanceRecords();
  const correctionsQuery = useMyAttendanceCorrections();
  const logMutation = useLogAttendance();

  const [logModalOpen, setLogModalOpen] = useState(false);
  const [logForm, setLogForm] = useState({ attendance_date: '', check_in_at: '', check_out_at: '' });

  async function handleLogAttendance() {
    if (!logForm.attendance_date) return;
    try {
      await logMutation.mutateAsync({
        attendance_date: logForm.attendance_date,
        check_in_at: logForm.check_in_at || undefined,
        check_out_at: logForm.check_out_at || undefined,
      });
      setLogModalOpen(false);
      setLogForm({ attendance_date: '', check_in_at: '', check_out_at: '' });
      toast.success('Attendance logged');
    } catch (error) {
      toast.error('Could not log attendance', actionError(error, 'Could not log this attendance record.'));
    }
  }

  const records = recordsQuery.data?.data ?? [];
  const corrections = correctionsQuery.data?.data ?? [];

  return (
    <div>
      <PageHeader
        title="My attendance"
        subtitle="Your attendance records and correction requests."
        actions={
          <Button type="button" variant="primary" onClick={() => setLogModalOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Log attendance
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Records</CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            {recordsQuery.isLoading && <LoadingState label="Loading your attendance…" />}
            {recordsQuery.isError && <ErrorState error={recordsQuery.error} onRetry={() => recordsQuery.refetch()} />}
            {recordsQuery.data && records.length === 0 && <EmptyState title="No attendance records yet" />}
            {records.length > 0 && (
              <ul className="divide-y divide-border">
                {records.map((record) => (
                  <li key={record.id} className="px-5 py-3 text-sm">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-strong">{formatDate(record.attendance_date)}</p>
                      <StatusBadge status={record.status} />
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {formatTime(record.check_in_at)} → {formatTime(record.check_out_at)}
                    </p>
                    <div className="mt-2">
                      <CorrectionButton record={record} onSubmitted={() => correctionsQuery.refetch()} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Correction requests</CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            {correctionsQuery.isLoading && <LoadingState label="Loading your corrections…" />}
            {correctionsQuery.isError && <ErrorState error={correctionsQuery.error} onRetry={() => correctionsQuery.refetch()} />}
            {correctionsQuery.data && corrections.length === 0 && <EmptyState title="No correction requests yet" />}
            {corrections.length > 0 && (
              <ul className="divide-y divide-border">
                {corrections.map((correction) => (
                  <li key={correction.id} className="px-5 py-3 text-sm">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-strong">{correction.reason}</p>
                      <StatusBadge status={correction.status} />
                    </div>
                    <p className="mt-1 text-xs text-muted">Submitted {formatDate(correction.submitted_at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <Modal
        open={logModalOpen}
        onClose={() => setLogModalOpen(false)}
        title="Log attendance"
        footer={
          <>
            <ModalCancelAction onClick={() => setLogModalOpen(false)} />
            <ModalSendAction title="Save" isLoading={logMutation.isPending} disabled={!logForm.attendance_date} onClick={handleLogAttendance} />
          </>
        }
      >
        <div className="space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">Date</span>
            <DatePicker value={logForm.attendance_date} onChange={(value) => setLogForm((current) => ({ ...current, attendance_date: value }))} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">Check-in</span>
            <input
              type="datetime-local"
              value={logForm.check_in_at}
              onChange={(event) => setLogForm((current) => ({ ...current, check_in_at: event.target.value }))}
              className="h-9 w-full rounded-md border border-border bg-white px-3 text-sm text-strong focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">Check-out</span>
            <input
              type="datetime-local"
              value={logForm.check_out_at}
              onChange={(event) => setLogForm((current) => ({ ...current, check_out_at: event.target.value }))}
              className="h-9 w-full rounded-md border border-border bg-white px-3 text-sm text-strong focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20"
            />
          </label>
        </div>
      </Modal>
    </div>
  );
}

export function MyAttendancePage() {
  return <MyAttendanceContent />;
}
