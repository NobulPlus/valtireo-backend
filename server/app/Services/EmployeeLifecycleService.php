<?php

namespace App\Services;

use App\Models\Employee;
use App\Models\EmployeeReportingHistory;
use App\Models\EmployeeStatusHistory;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class EmployeeLifecycleService
{
    private const PRE_ACTIVE_STATUSES = ['draft', 'invited', 'onboarding'];
    private const ACTIVE_LIFECYCLE_STATUSES = ['active', 'suspended', 'exited'];

    public function __construct(
        private readonly EmployeeProfileActivityService $activities,
        private readonly EmployeeOnboardingService $onboarding,
        private readonly LeaveEntitlementProvisioningService $leaveEntitlements,
        private readonly EmployeeActivationReadinessService $activationReadiness,
    ) {
    }

    /**
     * @param array<string, mixed> $data
     */
    public function changeStatus(User $actor, Employee $employee, array $data): EmployeeStatusHistory
    {
        $this->ensureSameOrganization($actor, $employee);

        if (! array_key_exists('new_status', $data) && ! array_key_exists('new_confirmation_status', $data)) {
            throw ValidationException::withMessages([
                'new_status' => ['Provide a new employment status, a new confirmation status, or both.'],
            ]);
        }

        return DB::transaction(function () use ($actor, $employee, $data): EmployeeStatusHistory {
            $previousStatus = $employee->status;
            $newStatus = $data['new_status'] ?? $previousStatus;
            $previousConfirmationStatus = $employee->confirmation_status;
            $newConfirmationStatus = $data['new_confirmation_status'] ?? $previousConfirmationStatus;

            if (in_array($previousStatus, self::ACTIVE_LIFECYCLE_STATUSES, true) && in_array($newStatus, self::PRE_ACTIVE_STATUSES, true)) {
                throw ValidationException::withMessages([
                    'new_status' => ['An employee in the active lifecycle cannot be moved back to draft, invited, or onboarding.'],
                ]);
            }

            if ($newStatus === 'invited' && $previousStatus !== 'invited') {
                if ($previousStatus !== 'draft') {
                    throw ValidationException::withMessages([
                        'new_status' => ['Only draft employees can be invited from the status action.'],
                    ]);
                }

                $this->onboarding->inviteExistingEmployee($actor, $employee);
                $employee->refresh();
            }

            if ($newStatus === 'active' && $previousStatus !== 'active') {
                $this->activationReadiness->ensureReady($employee);
            }

            $history = $employee->statusHistories()->create([
                'organization_id' => $employee->organization_id,
                'changed_by_id' => $actor->id,
                'previous_status' => $previousStatus,
                'new_status' => $newStatus,
                'previous_confirmation_status' => $previousConfirmationStatus,
                'new_confirmation_status' => $newConfirmationStatus,
                'effective_date' => $data['effective_date'],
                'reason' => $data['reason'] ?? null,
                'note' => $data['note'] ?? null,
            ]);

            $employee->update([
                'status' => $newStatus,
                'confirmation_status' => $newConfirmationStatus,
                'invited_at' => $newStatus === 'invited' ? ($employee->invited_at ?? now()) : $employee->invited_at,
                'activated_at' => $newStatus === 'active' ? ($employee->activated_at ?? now()) : $employee->activated_at,
                // Only meaningful while actually on probation — cleared on
                // any other confirmation transition so a stale date can't
                // linger and resurface if the employee re-enters probation
                // later (re-entering always requires setting a fresh date,
                // per StoreEmployeeStatusHistoryRequest's requiredIf rule).
                'probation_ends_at' => $newConfirmationStatus === 'probation' ? ($data['probation_ends_at'] ?? null) : null,
            ]);

            if ($newStatus === 'active') {
                $this->leaveEntitlements->grantDefaultsForActivation($employee);
            }

            $description = $newStatus !== $previousStatus && $newConfirmationStatus !== $previousConfirmationStatus
                ? "Status changed from {$previousStatus} to {$newStatus}, confirmation changed from {$previousConfirmationStatus} to {$newConfirmationStatus}."
                : ($newStatus !== $previousStatus
                    ? "Status changed from {$previousStatus} to {$newStatus}."
                    : "Confirmation changed from {$previousConfirmationStatus} to {$newConfirmationStatus}.");

            $this->activities->record(
                $employee,
                $actor,
                'status_changed',
                'Employment status changed',
                $description,
                $history,
                [
                    'previous_status' => $previousStatus,
                    'new_status' => $newStatus,
                    'previous_confirmation_status' => $previousConfirmationStatus,
                    'new_confirmation_status' => $newConfirmationStatus,
                    'effective_date' => $data['effective_date'],
                ]
            );

            return $history->load('changedBy');
        });
    }

    /**
     * @param array<string, mixed> $data
     */
    public function changeReportingManager(User $actor, Employee $employee, array $data): EmployeeReportingHistory
    {
        $this->ensureSameOrganization($actor, $employee);

        if (! empty($data['new_manager_id']) && (int) $data['new_manager_id'] === $employee->id) {
            throw ValidationException::withMessages([
                'new_manager_id' => ['An employee cannot report to themselves.'],
            ]);
        }

        return DB::transaction(function () use ($actor, $employee, $data): EmployeeReportingHistory {
            $previousManagerId = $employee->reporting_manager_id;

            $history = $employee->reportingHistories()->create([
                'organization_id' => $employee->organization_id,
                'previous_manager_id' => $previousManagerId,
                'new_manager_id' => $data['new_manager_id'] ?? null,
                'changed_by_id' => $actor->id,
                'effective_date' => $data['effective_date'],
                'reason' => $data['reason'] ?? null,
                'note' => $data['note'] ?? null,
            ]);

            $employee->update([
                'reporting_manager_id' => $data['new_manager_id'] ?? null,
            ]);

            $this->activities->record(
                $employee,
                $actor,
                'reporting_manager_changed',
                'Reporting manager changed',
                'Employee reporting relationship was updated.',
                $history,
                [
                    'previous_manager_id' => $previousManagerId,
                    'new_manager_id' => $data['new_manager_id'] ?? null,
                    'effective_date' => $data['effective_date'],
                ]
            );

            return $history->load(['previousManager', 'newManager', 'changedBy']);
        });
    }

    private function ensureSameOrganization(User $actor, Employee $employee): void
    {
        if ($employee->organization_id !== $actor->organization_id) {
            abort(404);
        }
    }
}
