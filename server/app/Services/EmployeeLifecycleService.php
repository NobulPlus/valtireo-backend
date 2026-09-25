<?php

namespace App\Services;

use App\Models\Asset;
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
        private readonly OperationAutomationService $automations,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function changeStatus(User $actor, Employee $employee, array $data): EmployeeStatusHistory
    {
        $this->ensureSameOrganization($actor, $employee);

        if (! array_key_exists('new_status', $data) && ! array_key_exists('new_confirmation_status', $data)) {
            throw ValidationException::withMessages([
                'new_status' => ['Provide a new employment status, a new confirmation status, or both.'],
            ]);
        }

        $history = DB::transaction(function () use ($actor, $employee, $data): EmployeeStatusHistory {
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

            if ($newStatus === 'exited' && $previousStatus !== 'exited') {
                $this->ensureAssetsAreCleared($employee);
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

        $employee->refresh();
        $context = [
            'organization_id' => $employee->organization_id,
            'event_id' => $history->id,
            'actor_user_id' => $actor->id,
            'subject_employee_id' => $employee->id,
            'assigned_user_id' => $employee->user_id,
            'previous_status' => $history->previous_status,
            'new_status' => $history->new_status,
            'previous_confirmation_status' => $history->previous_confirmation_status,
            'new_confirmation_status' => $history->new_confirmation_status,
            'effective_date' => $history->effective_date?->toDateString(),
        ];
        $this->automations->dispatch('employee.status_changed', $employee, $context);
        if ($history->previous_status !== $history->new_status && in_array($history->new_status, ['active', 'exited'], true)) {
            $lifecycleTrigger = $history->new_status === 'active' ? 'employee.activated' : 'employee.exited';
            $this->automations->dispatch($lifecycleTrigger, $employee, $context);
        }

        return $history;
    }

    /**
     * @param  array<string, mixed>  $data
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

    private function ensureAssetsAreCleared(Employee $employee): void
    {
        $assets = Asset::query()
            ->where('organization_id', $employee->organization_id)
            ->where('assigned_to_employee_id', $employee->id)
            ->orderBy('name')
            ->limit(4)
            ->get(['name', 'asset_tag']);

        if ($assets->isEmpty()) {
            return;
        }

        if ($assets->count() <= 3) {
            $assetList = $assets
                ->map(fn (Asset $asset) => "{$asset->name} ({$asset->asset_tag})")
                ->implode(', ');

            throw ValidationException::withMessages([
                'new_status' => ["Cannot exit employee. Outstanding assets: {$assetList}. Return or clear these assets first."],
            ]);
        }

        throw ValidationException::withMessages([
            'new_status' => ['Cannot exit employee. This employee still has outstanding assets. Return or clear assigned assets before exit.'],
        ]);
    }
}
