import { Modal } from '@/components/ui/Modal';
import { ModalCancelAction, ModalConfirmAction } from '@/components/ui/ModalActions';
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

  async function handleApprove() {
    try {
      await mutation.mutateAsync();
      toast.success('Onboarding approved', `${employee.full_name} is now active.`);
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
        This confirms {employee.full_name}'s onboarding is complete and activates their record. This action is
        recorded to the audit trail.
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
    </Modal>
  );
}
