<?php

namespace App\Http\Resources;

use App\Models\Employee;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\EmployeeReportingHistory */
class EmployeeReportingHistoryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'organization_id' => $this->organization_id,
            'employee_id' => $this->employee_id,
            'previous_manager_id' => $this->previous_manager_id,
            'new_manager_id' => $this->new_manager_id,
            'previous_manager' => $this->whenLoaded('previousManager', fn () => $this->employeeSummary($this->previousManager)),
            'new_manager' => $this->whenLoaded('newManager', fn () => $this->employeeSummary($this->newManager)),
            'effective_date' => $this->effective_date,
            'reason' => $this->reason,
            'note' => $this->note,
            'changed_by' => $this->whenLoaded('changedBy', fn () => $this->changedBy ? [
                'id' => $this->changedBy->id,
                'name' => $this->changedBy->name,
                'email' => $this->changedBy->email,
            ] : null),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function employeeSummary(?Employee $employee): ?array
    {
        if (! $employee) {
            return null;
        }

        return [
            'id' => $employee->id,
            'employee_number' => $employee->employee_number,
            'full_name' => trim($employee->first_name.' '.$employee->last_name),
            'work_email' => $employee->work_email,
        ];
    }
}
