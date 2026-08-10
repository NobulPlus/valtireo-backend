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
            'department' => $this->whenLoaded('department', fn () => [
                'id' => $this->department->id,
                'code' => $this->department->code,
                'name' => $this->department->name,
            ]),
            'unit' => $this->whenLoaded('unit', fn () => $this->unit ? [
                'id' => $this->unit->id,
                'code' => $this->unit->code,
                'name' => $this->unit->name,
            ] : null),
            'designation' => $this->whenLoaded('designation', fn () => [
                'id' => $this->designation->id,
                'code' => $this->designation->code,
                'name' => $this->designation->name,
            ]),
            'grade_level' => $this->whenLoaded('gradeLevel', fn () => $this->gradeLevel ? [
                'id' => $this->gradeLevel->id,
                'code' => $this->gradeLevel->code,
                'name' => $this->gradeLevel->name,
            ] : null),
            'employment_type' => $this->whenLoaded('employmentType', fn () => [
                'id' => $this->employmentType->id,
                'code' => $this->employmentType->code,
                'name' => $this->employmentType->name,
            ]),
            'location' => $this->whenLoaded('location', fn () => [
                'id' => $this->location->id,
                'code' => $this->location->code,
                'name' => $this->location->name,
            ]),
            'profile' => $this->whenLoaded('profile', fn () => $this->profile ? [
                'id' => $this->profile->id,
                'completion_status' => $this->profile->completion_status,
            ] : null),
            'user' => $this->whenLoaded('user', fn () => $this->user ? [
                'id' => $this->user->id,
                'name' => $this->user->name,
                'email' => $this->user->email,
            ] : null),
            'invitations' => $this->whenLoaded('invitations', fn () => $this->invitations->map(fn ($invitation) => [
                'id' => $invitation->id,
                'email' => $invitation->email,
                'status' => $invitation->status,
                'expires_at' => $invitation->expires_at,
                'accepted_at' => $invitation->accepted_at,
                'created_at' => $invitation->created_at,
            ])->values()),
            'emergency_contacts' => EmployeeEmergencyContactResource::collection($this->whenLoaded('emergencyContacts')),
            'dependents' => EmployeeDependentResource::collection($this->whenLoaded('dependents')),
            'documents' => EmployeeDocumentResource::collection($this->whenLoaded('documents')),
            'custom_fields' => EmployeeCustomFieldValueResource::collection($this->whenLoaded('customFieldValues')),
            'status_history' => EmployeeStatusHistoryResource::collection($this->whenLoaded('statusHistories')),
            'reporting_history' => EmployeeReportingHistoryResource::collection($this->whenLoaded('reportingHistories')),
            'activities' => EmployeeProfileActivityResource::collection($this->whenLoaded('profileActivities')),
            'invited_at' => $this->invited_at,
            'onboarding_completed_at' => $this->onboarding_completed_at,
            'activated_at' => $this->activated_at,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
