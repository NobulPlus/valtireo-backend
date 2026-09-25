<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\DocumentRequirement */
class DocumentRequirementResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'organization_id' => $this->organization_id,
            'document_type_id' => $this->document_type_id,
            'name' => $this->name,
            'description' => $this->description,
            'is_required' => $this->is_required,
            'employee_upload_allowed' => $this->employee_upload_allowed,
            'approval_required' => $this->approval_required,
            'reminder_days' => $this->reminder_days,
            'document_type' => $this->whenLoaded('documentType', fn () => [
                'id' => $this->documentType->id,
                'code' => $this->documentType->code,
                'name' => $this->documentType->name,
            ]),
            'department' => $this->whenLoaded('department', fn () => $this->department ? [
                'id' => $this->department->id,
                'code' => $this->department->code,
                'name' => $this->department->name,
            ] : null),
            'designation' => $this->whenLoaded('designation', fn () => $this->designation ? [
                'id' => $this->designation->id,
                'code' => $this->designation->code,
                'name' => $this->designation->name,
            ] : null),
            'grade_level' => $this->whenLoaded('gradeLevel', fn () => $this->gradeLevel ? [
                'id' => $this->gradeLevel->id,
                'code' => $this->gradeLevel->code,
                'name' => $this->gradeLevel->name,
            ] : null),
            'employment_type' => $this->whenLoaded('employmentType', fn () => $this->employmentType ? [
                'id' => $this->employmentType->id,
                'code' => $this->employmentType->code,
                'name' => $this->employmentType->name,
            ] : null),
            'location' => $this->whenLoaded('location', fn () => $this->location ? [
                'id' => $this->location->id,
                'code' => $this->location->code,
                'name' => $this->location->name,
            ] : null),
            'is_active' => $this->is_active,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
