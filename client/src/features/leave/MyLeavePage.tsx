import { useState } from 'react';
import { FileText, Plus, Users, X } from 'lucide-react';
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
import { useEmployeeDirectory } from '@/features/employees/api';
import {
  openLeaveEvidenceInNewTab,
  openLeaveHandoverDocumentInNewTab,
  useCancelLeaveRequest,
  useCreateLeaveRequest,
  useLeaveTypes,
  useMyLeaveRequests,
} from '@/features/leave/api';
import { useMyProfileOverview } from '@/features/profile/api';
import { ApiError } from '@/lib/apiClient';
import { useDateFormatter } from '@/lib/dateFormat';
import type { LeaveRequest } from '@/types/api';

function actionError(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

/** Date-only (UTC) comparison — API dates arrive as full ISO datetimes. */
function dateOnly(value: string): string {
  return value.slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * A request is still "active" while it's either awaiting a decision, or
 * approved with at least one day strictly in the future left to return —
 * the same condition that makes it cancellable. Once nothing is left to
 * cancel (or it was rejected/cancelled outright), it's history, not a
 * request anymore.
 */
function isActiveRequest(request: LeaveRequest): boolean {
  if (request.status === 'submitted' || request.status === 'changes_requested') return true;
  if (request.status === 'approved') return dateOnly(request.ends_on) > today();
  return false;
}

function cancelLeaveNotice(request: LeaveRequest): string {
  if (request.status !== 'approved') {
    return 'This will cancel your leave request. You can optionally add a note.';
  }

  if (dateOnly(request.starts_on) > today()) {
    return 'This leave has not started yet — all days will be returned to your balance.';
  }

  return 'This leave is already in progress. Days up to today stay recorded as used; any remaining days will be returned to your balance automatically.';
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
        <p className="mb-3 text-sm text-muted">{cancelLeaveNotice(request)}</p>
        <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Reason (optional)" />
      </Modal>
    </>
  );
}

function MyLeaveContent() {
  const toast = useToast();
  const { formatDate } = useDateFormatter();
  const dashboardQuery = useMyDashboard();
  const requestsQuery = useMyLeaveRequests();
  const leaveTypesQuery = useLeaveTypes();
  const profileQuery = useMyProfileOverview();
  const createMutation = useCreateLeaveRequest();

  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [form, setForm] = useState({ leave_type_id: '', starts_on: '', ends_on: '', reason: '' });
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [handoverEmployeeId, setHandoverEmployeeId] = useState('');
  const [handoverNote, setHandoverNote] = useState('');
  const [handoverDocument, setHandoverDocument] = useState<File | null>(null);
  const [handoverScope, setHandoverScope] = useState<'department' | 'all'>('department');
  const myEmployeeId = profileQuery.data?.employee?.id ?? null;
  const directoryQuery = useEmployeeDirectory(
    handoverScope === 'all' ? { department_id: 'all', per_page: 100 } : { per_page: 100 },
  );
  const handoverOptions = (directoryQuery.data?.data ?? [])
    .filter((employee) => employee.id !== myEmployeeId)
    .map((employee) => ({ value: String(employee.id), label: `${employee.full_name} · ${employee.employee_number}` }));
  const myGender = profileQuery.data?.profile?.gender ?? null;
  const selectableLeaveTypes = (leaveTypesQuery.data?.data ?? []).filter(
    (type) => !type.restricted_to_gender || type.restricted_to_gender === myGender,
  );
  const selectedLeaveType = selectableLeaveTypes.find((type) => String(type.id) === form.leave_type_id);
  const evidenceRequired = selectedLeaveType?.requires_attachment === true;

  async function handleViewEvidence(request: LeaveRequest) {
    try {
      await openLeaveEvidenceInNewTab(request);
    } catch (error) {
      toast.error('Could not open evidence', actionError(error, 'Could not open this leave evidence.'));
    }
  }

  async function handleViewHandoverDocument(request: LeaveRequest) {
    try {
      await openLeaveHandoverDocumentInNewTab(request);
    } catch (error) {
      toast.error('Could not open handover document', actionError(error, 'Could not open this handover document.'));
    }
  }

  function resetForm() {
    setForm({ leave_type_id: '', starts_on: '', ends_on: '', reason: '' });
    setEvidenceFile(null);
    setHandoverEmployeeId('');
    setHandoverNote('');
    setHandoverDocument(null);
    setHandoverScope('department');
  }

  async function handleSubmitRequest() {
    if (!form.leave_type_id || !form.starts_on || !form.ends_on || (evidenceRequired && !evidenceFile)) return;
    try {
      await createMutation.mutateAsync({
        leave_type_id: Number(form.leave_type_id),
        starts_on: form.starts_on,
        ends_on: form.ends_on,
        reason: form.reason || undefined,
        evidence: evidenceFile,
        handover_to_employee_id: handoverEmployeeId ? Number(handoverEmployeeId) : undefined,
        handover_note: handoverNote || undefined,
        handover_document: handoverDocument,
      });
      setRequestModalOpen(false);
      resetForm();
      toast.success('Leave requested', 'Your request has been submitted for approval.');
    } catch (error) {
      toast.error('Could not submit request', actionError(error, 'Could not submit your leave request.'));
    }
  }

  const balances = dashboardQuery.data?.leave?.balances ?? [];
  const allRequests = requestsQuery.data?.data ?? [];
  const requests = allRequests.filter((request) => request.employee?.id === myEmployeeId || !request.employee);
  const handoverAssignments = allRequests
    .filter((request) => request.employee?.id !== myEmployeeId && request.handover_to_employee_id === myEmployeeId)
    .filter(isActiveRequest);
  const activeRequests = requests.filter(isActiveRequest);
  const history = requests.filter((request) => !isActiveRequest(request));

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

      <Card className="mb-5">
        <CardHeader>
          <CardTitle>Requests</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {requestsQuery.isLoading && <LoadingState label="Loading your leave requests…" />}
          {requestsQuery.isError && <ErrorState error={requestsQuery.error} onRetry={() => requestsQuery.refetch()} />}
          {requestsQuery.data && activeRequests.length === 0 && (
            <EmptyState title="No open requests" description="Requests you submit will appear here until they're resolved." />
          )}
          {activeRequests.length > 0 && (
            <ul className="divide-y divide-border">
              {activeRequests.map((request) => (
                <li key={request.id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <div>
                    <p className="font-medium text-strong">{request.leave_type?.name ?? 'Leave'}</p>
                    <p className="text-xs text-muted">
                      {formatDate(request.starts_on)} → {formatDate(request.ends_on)} · {request.total_days} day(s)
                    </p>
                    {request.evidence_download_url && (
                      <button
                        type="button"
                        onClick={() => handleViewEvidence(request)}
                        className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-teal hover:underline"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        {request.evidence_file_name ?? 'View evidence'}
                      </button>
                    )}
                    {request.handover_to && (
                      <p className="mt-1 text-xs text-muted">
                        Handover: <span className="font-medium text-strong">{request.handover_to.full_name}</span>
                        {request.handover_download_url && (
                          <button
                            type="button"
                            onClick={() => handleViewHandoverDocument(request)}
                            className="ml-1 inline-flex items-center gap-1 font-medium text-teal hover:underline"
                          >
                            <FileText className="h-3 w-3" />
                            {request.handover_file_name ?? 'View document'}
                          </button>
                        )}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={request.status} />
                    <CancelLeaveButton request={request} onCancelled={() => requestsQuery.refetch()} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {handoverAssignments.length > 0 && (
        <Card className="mb-5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted" /> Covering for others
            </CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            <ul className="divide-y divide-border">
              {handoverAssignments.map((request) => (
                <li key={request.id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <div>
                    <p className="font-medium text-strong">
                      {request.employee?.full_name ?? 'A colleague'} · {request.leave_type?.name ?? 'Leave'}
                    </p>
                    <p className="text-xs text-muted">
                      {formatDate(request.starts_on)} → {formatDate(request.ends_on)} · {request.total_days} day(s)
                    </p>
                    {request.handover_note && <p className="mt-1 text-xs text-muted">{request.handover_note}</p>}
                    {request.handover_download_url && (
                      <button
                        type="button"
                        onClick={() => handleViewHandoverDocument(request)}
                        className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-teal hover:underline"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        {request.handover_file_name ?? 'View handover document'}
                      </button>
                    )}
                  </div>
                  <StatusBadge status={request.status} />
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {requestsQuery.data && history.length === 0 && (
            <EmptyState title="No leave history yet" description="Completed, cancelled, or rejected leave will appear here." />
          )}
          {history.length > 0 && (
            <ul className="divide-y divide-border">
              {history.map((request) => (
                <li key={request.id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <div>
                    <p className="font-medium text-strong">{request.leave_type?.name ?? 'Leave'}</p>
                    <p className="text-xs text-muted">
                      {formatDate(request.starts_on)} → {formatDate(request.ends_on)} · {request.total_days} day(s)
                    </p>
                    {request.evidence_download_url && (
                      <button
                        type="button"
                        onClick={() => handleViewEvidence(request)}
                        className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-teal hover:underline"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        {request.evidence_file_name ?? 'View evidence'}
                      </button>
                    )}
                    {request.handover_to && (
                      <p className="mt-1 text-xs text-muted">
                        Handover: <span className="font-medium text-strong">{request.handover_to.full_name}</span>
                      </p>
                    )}
                  </div>
                  <StatusBadge status={request.status} />
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Modal
        open={requestModalOpen}
        onClose={() => {
          setRequestModalOpen(false);
          resetForm();
        }}
        title="Request leave"
        size="lg"
        footer={
          <>
            <ModalCancelAction
              onClick={() => {
                setRequestModalOpen(false);
                resetForm();
              }}
            />
            <ModalSendAction
              title="Submit request"
              isLoading={createMutation.isPending}
              disabled={
                !form.leave_type_id ||
                !form.starts_on ||
                !form.ends_on ||
                (evidenceRequired && !evidenceFile) ||
                (!handoverEmployeeId && (Boolean(handoverNote) || handoverDocument !== null))
              }
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
              onChange={(value) => {
                setForm((current) => ({ ...current, leave_type_id: value }));
                setEvidenceFile(null);
              }}
              options={selectableLeaveTypes.map((type) => ({ value: String(type.id), label: type.name }))}
              placeholder="Select leave type"
            />
            {evidenceRequired && (
              <span className="mt-1 block text-xs text-pending">This leave type requires supporting evidence.</span>
            )}
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
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">
              Evidence {evidenceRequired ? '' : '(optional)'}
            </span>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              onChange={(event) => setEvidenceFile(event.target.files?.[0] ?? null)}
              className="block w-full text-sm text-muted file:mr-3 file:rounded-md file:border file:border-border file:bg-surface file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-strong"
            />
            {evidenceFile && <span className="mt-1 block text-xs text-muted">{evidenceFile.name}</span>}
          </label>

          <div className="space-y-4 border-t border-border pt-4">
            <p className="text-xs font-medium text-muted">Handover (optional)</p>
            <div className="inline-flex rounded-md border border-border p-0.5">
              <button
                type="button"
                onClick={() => {
                  setHandoverScope('department');
                  setHandoverEmployeeId('');
                }}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                  handoverScope === 'department' ? 'bg-teal text-white' : 'text-muted hover:text-strong'
                }`}
              >
                My department
              </button>
              <button
                type="button"
                onClick={() => {
                  setHandoverScope('all');
                  setHandoverEmployeeId('');
                }}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                  handoverScope === 'all' ? 'bg-teal text-white' : 'text-muted hover:text-strong'
                }`}
              >
                Entire organization
              </button>
            </div>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-muted">Hand over to</span>
              <SelectMenu
                value={handoverEmployeeId}
                onChange={setHandoverEmployeeId}
                options={handoverOptions}
                placeholder={directoryQuery.isLoading ? 'Loading colleagues…' : 'Select a colleague'}
                searchable
                disabled={directoryQuery.isLoading}
              />
            </label>
            {handoverEmployeeId && (
              <>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-medium text-muted">Handover note</span>
                  <Textarea
                    value={handoverNote}
                    onChange={(event) => setHandoverNote(event.target.value)}
                    placeholder="What should they cover while you're away?"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-medium text-muted">Handover document (optional)</span>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.csv,.txt"
                    onChange={(event) => setHandoverDocument(event.target.files?.[0] ?? null)}
                    className="block w-full text-sm text-muted file:mr-3 file:rounded-md file:border file:border-border file:bg-surface file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-strong"
                  />
                  {handoverDocument && <span className="mt-1 block text-xs text-muted">{handoverDocument.name}</span>}
                </label>
              </>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}

export function MyLeavePage() {
  return <MyLeaveContent />;
}
