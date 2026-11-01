import { useState, type ReactNode } from 'react';
import { DatePicker } from '@/components/ui/DatePicker';
import { Input, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ModalCancelAction, ModalConfirmAction, ModalSaveAction } from '@/components/ui/ModalActions';
import { SelectMenu } from '@/components/ui/SelectMenu';
import { useToast } from '@/components/ui/Toast';
import { ApiError } from '@/lib/apiClient';
import type { Employee } from '@/types/api';
import { useChangeEmployeeStatus } from '@/features/employees/api';
import { confirmationStatusOptionsFor, statusLabel, statusOptionsFor } from '@/features/employees/statusHelpers';

function today(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Moving an active employee straight to one of these is disruptive and hard to undo casually — require an explicit second confirmation, matching the danger-styled confirm step every other destructive action in the app already uses (asset/role delete, setup-data delete/deactivate). */
const DISRUPTIVE_STATUSES = ['suspended', 'exited'];

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

export function ChangeStatusModal({
  employee,
  open,
  onClose,
  onChanged,
}: {
  employee: Employee;
  open: boolean;
  onClose: () => void;
  /** Fires after a successful status change, in addition to onClose. */
  onChanged?: () => void;
}) {
  const toast = useToast();
  const [newStatus, setNewStatus] = useState('');
  const [newConfirmationStatus, setNewConfirmationStatus] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(today());
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [probationEndsAt, setProbationEndsAt] = useState(employee.probation_ends_at?.slice(0, 10) ?? '');
  const [probationEndsAtError, setProbationEndsAtError] = useState<string | null>(null);
  const [disruptiveConfirmed, setDisruptiveConfirmed] = useState(false);
  const mutation = useChangeEmployeeStatus(employee.id);

  const resolvedStatus = newStatus || employee.status;
  const resolvedConfirmationStatus = newConfirmationStatus || employee.confirmation_status;
  const movingToProbation = resolvedConfirmationStatus === 'probation';
  const isDisruptiveChange = resolvedStatus !== employee.status && DISRUPTIVE_STATUSES.includes(resolvedStatus);
  const needsConfirmation = isDisruptiveChange && !disruptiveConfirmed;

  async function handleSave() {
    setProbationEndsAtError(null);

    if (movingToProbation) {
      if (!probationEndsAt) {
        setProbationEndsAtError('Set when probation ends — this drives the review reminder.');
        return;
      }
      if (probationEndsAt <= effectiveDate) {
        setProbationEndsAtError('Must be after the effective date.');
        return;
      }
    }

    // First click on a disruptive change only arms the confirmation — the button
    // swaps to a danger-styled "confirm" step and submission waits for a second click.
    if (needsConfirmation) {
      setDisruptiveConfirmed(true);
      return;
    }

    try {
      await mutation.mutateAsync({
        new_status: resolvedStatus,
        new_confirmation_status: resolvedConfirmationStatus,
        effective_date: effectiveDate,
        reason: reason || undefined,
        note: note || undefined,
        probation_ends_at: movingToProbation ? probationEndsAt : undefined,
      });
      toast.success('Status updated', `${employee.full_name}'s lifecycle history has been updated.`);
      setNewStatus('');
      setNewConfirmationStatus('');
      setReason('');
      setNote('');
      setDisruptiveConfirmed(false);
      onClose();
      onChanged?.();
    } catch (error) {
      toast.error('Could not change status', error instanceof ApiError ? error.message : 'Could not change status.');
    }
  }

  function handleStatusChange(value: string) {
    setNewStatus(value);
    setDisruptiveConfirmed(false);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Change status — ${employee.full_name}`}
      footer={
        <>
          <ModalCancelAction onClick={onClose} disabled={mutation.isPending} />
          {needsConfirmation ? (
            <ModalConfirmAction
              variant="danger"
              title={`Confirm: move to ${statusLabel(resolvedStatus)}`}
              isLoading={mutation.isPending}
              onClick={handleSave}
            />
          ) : (
            <ModalSaveAction title="Save status" isLoading={mutation.isPending} onClick={handleSave} />
          )}
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Employment status">
          <SelectMenu value={newStatus || employee.status} onChange={handleStatusChange} options={statusOptionsFor(employee)} />
          {employee.status === 'draft' && !employee.work_email && (
            <p className="mt-1 text-xs text-warning">Add a work email before inviting this employee.</p>
          )}
          {needsConfirmation && (
            <p className="mt-1 text-xs text-danger">
              Moving {employee.full_name} to {statusLabel(resolvedStatus).toLowerCase()} is disruptive — click the confirm button again to proceed.
            </p>
          )}
        </Field>
        <Field label="Confirmation status">
          <SelectMenu
            value={newConfirmationStatus || employee.confirmation_status}
            onChange={setNewConfirmationStatus}
            options={confirmationStatusOptionsFor(employee)}
          />
          <p className="mt-1 text-xs text-muted">Whether this employee has cleared probation — independent of employment status.</p>
        </Field>
        <Field label="Effective date">
          <DatePicker value={effectiveDate} onChange={setEffectiveDate} />
        </Field>
        {movingToProbation && (
          <Field label="Probation ends">
            <DatePicker value={probationEndsAt} onChange={setProbationEndsAt} />
            {probationEndsAtError ? (
              <p className="mt-1 text-xs text-danger">{probationEndsAtError}</p>
            ) : (
              <p className="mt-1 text-xs text-muted">HR gets a reminder as this date approaches and again if it passes.</p>
            )}
          </Field>
        )}
        <Field label="Reason">
          <Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Optional reason" />
        </Field>
        <Field label="Note">
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional internal note" />
        </Field>
      </div>
    </Modal>
  );
}
