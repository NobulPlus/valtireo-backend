<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Employee */
class EmployeeResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'organization_id' => $this->organization_id,
            'user_id' => $this->user_id,
            'employee_number' => $this->employee_number,
            'first_name' => $this->first_name,
            'middle_name' => $this->middle_name,
            'last_name' => $this->last_name,
            'full_name' => trim($this->first_name.' '.$this->last_name),
            'work_email' => $this->work_email,
            'phone' => $this->phone,
            'department_id' => $this->department_id,
            'unit_id' => $this->unit_id,
            'designation_id' => $this->designation_id,
            'grade_level_id' => $this->grade_level_id,
            'employment_type_id' => $this->employment_type_id,
            'organization_location_id' => $this->organization_location_id,
            'reporting_manager_id' => $this->reporting_manager_id,
            'start_date' => $this->start_date,
            'status' => $this->status,
            'invited_at' => $this->invited_at,
            'onboarding_completed_at' => $this->onboarding_completed_at,
            'activated_at' => $this->activated_at,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
