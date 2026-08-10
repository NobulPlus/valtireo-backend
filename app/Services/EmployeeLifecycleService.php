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
    public function __construct(private readonly EmployeeProfileActivityService $activities)
    {
    }

    /**
     * @param array<string, mixed> $data
     */
    public function changeStatus(User $actor, Employee $employee, array $data): EmployeeStatusHistory
    {
        $this->ensureSameOrganization($actor, $employee);

        return DB::transaction(function () use ($actor, $employee, $data): EmployeeStatusHistory {
            $previousStatus = $employee->status;

            $history = $employee->statusHistories()->create([
                'organization_id' => $employee->organization_id,
                'changed_by_id' => $actor->id,
                'previous_status' => $previousStatus,
                'new_status' => $data['new_status'],
                'effective_date' => $data['effective_date'],
                'reason' => $data['reason'] ?? null,
                'note' => $data['note'] ?? null,
            ]);

            $employee->update([
                'status' => $data['new_status'],
                'activated_at' => $data['new_status'] === 'active' ? ($employee->activated_at ?? now()) : $employee->activated_at,
            ]);

            $this->activities->record(
                $employee,
                $actor,
                'status_changed',
                'Employment status changed',
                "Status changed from {$previousStatus} to {$data['new_status']}.",
                $history,
                [
                    'previous_status' => $previousStatus,
                    'new_status' => $data['new_status'],
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
