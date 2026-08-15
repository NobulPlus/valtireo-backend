import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import { DatePicker } from '@/components/ui/DatePicker';
import { SelectMenu } from '@/components/ui/SelectMenu';
import { Modal } from '@/components/ui/Modal';
import { ModalCancelAction, ModalConfirmAction, ModalSendAction } from '@/components/ui/ModalActions';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/Toast';
import { useMyDashboard } from '@/features/dashboard/api';
import { useCancelLeaveRequest, useCreateLeaveRequest, useLeaveTypes, useMyLeaveRequests } from '@/features/leave/api';
import { ApiError } from '@/lib/apiClient';
import type { LeaveRequest } from '@/types/api';

function actionError(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  const dateOnly = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return dateOnly ? dateOnly[1] : value;
}

function CancelLeaveButton({ request, onCancelled }: { request: LeaveRequest; onCancelled: () => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const cancelMutation = useCancelLeaveRequest(request.id);

  async function handleCancel() {
    try {
      await cancelMutation.mutateAsync(note || undefined);
      setOpen(false);
      setNote('');
      toast.success('Leave request cancelled');
      onCancelled();
    } catch (error) {
      toast.error('Could not cancel request', actionError(error, 'Could not cancel this leave request.'));
    }
  }

  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <X className="h-3.5 w-3.5" /> Cancel
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Cancel leave request"
        footer={
          <>
            <ModalCancelAction onClick={() => setOpen(false)} />
            <ModalConfirmAction title="Cancel request" variant="danger" isLoading={cancelMutation.isPending} onClick={handleCancel} />
          </>
        }
      >
        <p className="mb-3 text-sm text-muted">This will cancel your leave request. You can optionally add a note.</p>
        <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Reason (optional)" />
      </Modal>
    </>
  );
}

function MyLeaveContent() {
  const toast = useToast();
  const dashboardQuery = useMyDashboard();
  const requestsQuery = useMyLeaveRequests();
  const leaveTypesQuery = useLeaveTypes();
  const createMutation = useCreateLeaveRequest();

  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [form, setForm] = useState({ leave_type_id: '', starts_on: '', ends_on: '', reason: '' });

  async function handleSubmitRequest() {
    if (!form.leave_type_id || !form.starts_on || !form.ends_on) return;
    try {
      await createMutation.mutateAsync({
        leave_type_id: Number(form.leave_type_id),
        starts_on: form.starts_on,
        ends_on: form.ends_on,
        reason: form.reason || undefined,
      });
      setRequestModalOpen(false);
      setForm({ leave_type_id: '', starts_on: '', ends_on: '', reason: '' });
      toast.success('Leave requested', 'Your request has been submitted for approval.');
    } catch (error) {
      toast.error('Could not submit request', actionError(error, 'Could not submit your leave request.'));
    }
  }

  const balances = dashboardQuery.data?.leave?.balances ?? [];
  const requests = requestsQuery.data?.data ?? [];

  return (
    <div>
      <PageHeader
        title="My leave"
        subtitle="Your leave balance and request history."
        actions={
          <Button type="button" variant="primary" onClick={() => setRequestModalOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Request leave
          </Button>
        }
      />

      {balances.length > 0 && (
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {balances.map((balance) => (
            <Card key={balance.leave_type.id}>
              <CardBody>
                <p className="text-xs font-medium text-muted">{balance.leave_type.name}</p>
                <p className="mt-1 font-display text-xl font-semibold text-strong">{balance.days_available}</p>
                <p className="text-xs text-muted">of {balance.days_allocated} days available</p>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Requests</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {requestsQuery.isLoading && <LoadingState label="Loading your leave requests…" />}
          {requestsQuery.isError && <ErrorState error={requestsQuery.error} onRetry={() => requestsQuery.refetch()} />}
          {requestsQuery.data && requests.length === 0 && (
            <EmptyState title="No leave requests yet" description="Requests you submit will appear here." />
          )}
          {requests.length > 0 && (
            <ul className="divide-y divide-border">
              {requests.map((request) => (
                <li key={request.id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <div>
                    <p className="font-medium text-strong">{request.leave_type?.name ?? 'Leave'}</p>
                    <p className="text-xs text-muted">
                      {formatDate(request.starts_on)} → {formatDate(request.ends_on)} · {request.total_days} day(s)
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={request.status} />
                    {(request.status === 'pending' || request.status === 'approved') && (
                      <CancelLeaveButton request={request} onCancelled={() => requestsQuery.refetch()} />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Modal
        open={requestModalOpen}
        onClose={() => setRequestModalOpen(false)}
        title="Request leave"
        footer={
          <>
            <ModalCancelAction onClick={() => setRequestModalOpen(false)} />
            <ModalSendAction
              title="Submit request"
              isLoading={createMutation.isPending}
              disabled={!form.leave_type_id || !form.starts_on || !form.ends_on}
              onClick={handleSubmitRequest}
            />
          </>
        }
      >
        <div className="space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">Leave type</span>
            <SelectMenu
              value={form.leave_type_id}
              onChange={(value) => setForm((current) => ({ ...current, leave_type_id: value }))}
              options={(leaveTypesQuery.data?.data ?? []).map((type) => ({ value: String(type.id), label: type.name }))}
              placeholder="Select leave type"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">Starts on</span>
            <DatePicker value={form.starts_on} onChange={(value) => setForm((current) => ({ ...current, starts_on: value }))} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">Ends on</span>
            <DatePicker value={form.ends_on} onChange={(value) => setForm((current) => ({ ...current, ends_on: value }))} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">Reason</span>
            <Textarea value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} />
          </label>
        </div>
      </Modal>
    </div>
  );
}

export function MyLeavePage() {
  return <MyLeaveContent />;
}
