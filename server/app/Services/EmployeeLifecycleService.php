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
    private const ACTIVE_LIFECYCLE_STATUSES = ['active', 'probation', 'confirmed', 'suspended', 'exited'];
    private const REQUIRED_BIODATA_FIELDS = [
        'date_of_birth' => 'Date of birth',
        'gender' => 'Gender',
        'residential_address' => 'Residential address',
        'next_of_kin_name' => 'Next of kin name',
        'next_of_kin_phone' => 'Next of kin phone',
        'emergency_contact_name' => 'Emergency contact name',
        'emergency_contact_phone' => 'Emergency contact phone',
    ];

    public function __construct(
        private readonly EmployeeProfileActivityService $activities,
        private readonly EmployeeOnboardingService $onboarding,
    ) {
    }

    /**
     * @param array<string, mixed> $data
     */
    public function changeStatus(User $actor, Employee $employee, array $data): EmployeeStatusHistory
    {
        $this->ensureSameOrganization($actor, $employee);

        return DB::transaction(function () use ($actor, $employee, $data): EmployeeStatusHistory {
            $previousStatus = $employee->status;
            $newStatus = $data['new_status'];

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

            if ($newStatus === 'active') {
                $this->ensureBiodataIsReadyForActivation($employee);
            }

            $history = $employee->statusHistories()->create([
                'organization_id' => $employee->organization_id,
                'changed_by_id' => $actor->id,
                'previous_status' => $previousStatus,
                'new_status' => $newStatus,
                'effective_date' => $data['effective_date'],
                'reason' => $data['reason'] ?? null,
                'note' => $data['note'] ?? null,
            ]);

            $employee->update([
                'status' => $newStatus,
                'invited_at' => $newStatus === 'invited' ? ($employee->invited_at ?? now()) : $employee->invited_at,
                'activated_at' => $newStatus === 'active' ? ($employee->activated_at ?? now()) : $employee->activated_at,
                // Only meaningful while actually on probation — cleared on
                // any other transition so a stale date can't linger and
                // resurface if the employee re-enters probation later
                // (re-entering always requires setting a fresh date, per
                // StoreEmployeeStatusHistoryRequest's requiredIf rule).
                'probation_ends_at' => $newStatus === 'probation' ? ($data['probation_ends_at'] ?? null) : null,
            ]);

            $this->activities->record(
                $employee,
                $actor,
                'status_changed',
                'Employment status changed',
                "Status changed from {$previousStatus} to {$newStatus}.",
                $history,
                [
                    'previous_status' => $previousStatus,
                    'new_status' => $newStatus,
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

    private function ensureBiodataIsReadyForActivation(Employee $employee): void
    {
        $employee->loadMissing('profile');
        $profile = $employee->profile;
        $missing = [];

        foreach (self::REQUIRED_BIODATA_FIELDS as $field => $label) {
            if (! $profile || blank($profile->{$field})) {
                $missing[] = $label;
            }
        }

        if ($missing === []) {
            return;
        }

        $message = count($missing) <= 3
            ? 'Cannot activate employee. Missing biodata: '.implode(', ', $missing).'.'
            : 'Cannot activate employee. Important biodata is missing. Review the employee biodata before activation.';

        throw ValidationException::withMessages([
            'new_status' => [$message],
        ]);
    }
}
