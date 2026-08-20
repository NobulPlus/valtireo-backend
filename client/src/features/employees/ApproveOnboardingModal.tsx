import { useState } from 'react';
import { DatePicker } from '@/components/ui/DatePicker';
import { Modal } from '@/components/ui/Modal';
import { ModalCancelAction, ModalConfirmAction } from '@/components/ui/ModalActions';
import { SelectMenu, type SelectMenuOption } from '@/components/ui/SelectMenu';
import { useToast } from '@/components/ui/Toast';
import { ApiError } from '@/lib/apiClient';
import { cn } from '@/lib/cn';
import type { Employee } from '@/types/api';
import { useApproveOnboarding } from '@/features/employees/api';
import { isReadyForOnboardingApproval, statusLabel } from '@/features/employees/statusHelpers';

function ApprovalCheck({ complete, label, value }: { complete: boolean; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className={cn('font-medium', complete ? 'text-success' : 'text-warning')}>{label}</span>
      <span className="text-muted">{value}</span>
    </div>
  );
}

const STAGE_OPTIONS: SelectMenuOption[] = [
  { value: 'probation', label: 'Probation', description: 'Starts on probation with a review date. Most new hires start here.' },
  { value: 'confirmed', label: 'Confirmed', description: 'Skips probation — this employee is confirmed immediately.' },
  { value: 'active', label: 'Active (no stage tracking)', description: "For roles where your organization doesn't track probation or confirmation." },
];

export function ApproveOnboardingModal({
  employee,
  open,
  onClose,
  onApproved,
}: {
  employee: Employee;
  open: boolean;
  onClose: () => void;
  onApproved?: () => void;
}) {
  const toast = useToast();
  const mutation = useApproveOnboarding(employee.id);
  const profileReady = isReadyForOnboardingApproval(employee);
  const [newStatus, setNewStatus] = useState('');
  const [probationEndsAt, setProbationEndsAt] = useState('');
  const [stageError, setStageError] = useState<string | null>(null);
  const [probationEndsAtError, setProbationEndsAtError] = useState<string | null>(null);

  async function handleApprove() {
    setStageError(null);
    setProbationEndsAtError(null);

    if (!newStatus) {
      setStageError('Choose the stage this employee starts at.');
      return;
    }
    if (newStatus === 'probation' && !probationEndsAt) {
      setProbationEndsAtError('Set when probation ends — this drives the review reminder.');
      return;
    }

    try {
      await mutation.mutateAsync({
        new_status: newStatus as 'active' | 'probation' | 'confirmed',
        probation_ends_at: newStatus === 'probation' ? probationEndsAt : undefined,
      });
      toast.success('Onboarding approved', `${employee.full_name} is now ${statusLabel(newStatus).toLowerCase()}.`);
      setNewStatus('');
      setProbationEndsAt('');
      onClose();
      onApproved?.();
    } catch (error) {
      toast.error('Could not approve onboarding', error instanceof ApiError ? error.message : 'Could not approve onboarding.');
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Approve onboarding"
      footer={
        <>
          <ModalCancelAction onClick={onClose} disabled={mutation.isPending} />
          <ModalConfirmAction
            title="Approve onboarding"
            isLoading={mutation.isPending}
            disabled={!profileReady}
            onClick={handleApprove}
          />
        </>
      }
    >
      <p>
        This confirms {employee.full_name}'s onboarding is complete. This action is recorded to the audit trail.
      </p>
      <div className="mt-4 space-y-2 rounded-md border border-border bg-surface-soft p-3">
        <ApprovalCheck
          complete={employee.status === 'onboarding'}
          label="Employee is in onboarding"
          value={statusLabel(employee.status)}
        />
        <ApprovalCheck complete={profileReady} label="Profile is ready" value={statusLabel(employee.profile?.completion_status)} />
      </div>
      {!profileReady && (
        <p className="mt-3 rounded-md bg-warning/10 px-3 py-2 text-sm text-warning">
          This employee cannot be approved yet. Ask the employee to complete and submit their profile, or use
          Edit employee record if HR needs to fill missing biodata before submission.
        </p>
      )}
      {profileReady && (
        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">Starting stage</span>
            <SelectMenu value={newStatus} onChange={setNewStatus} options={STAGE_OPTIONS} placeholder="Select a stage..." />
            {stageError && <p className="mt-1 text-xs text-danger">{stageError}</p>}
          </label>
          {newStatus === 'probation' && (
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-muted">Probation ends</span>
              <DatePicker value={probationEndsAt} onChange={setProbationEndsAt} />
              {probationEndsAtError ? (
                <p className="mt-1 text-xs text-danger">{probationEndsAtError}</p>
              ) : (
                <p className="mt-1 text-xs text-muted">HR gets a reminder as this date approaches and again if it passes.</p>
              )}
            </label>
          )}
        </div>
      )}
    </Modal>
  );
}
