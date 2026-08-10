<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\EmployeeDocument */
class EmployeeDocumentResource extends JsonResource
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
            'document_type_id' => $this->document_type_id,
            'document_requirement_id' => $this->document_requirement_id,
            'title' => $this->title,
            'file_name' => $this->file_name,
            'file_path' => $this->file_path,
            'mime_type' => $this->mime_type,
            'file_size' => $this->file_size,
            'issued_at' => $this->issued_at,
            'expires_at' => $this->expires_at,
            'status' => $this->status,
            'notes' => $this->notes,
            'review_note' => $this->review_note,
            'submitted_at' => $this->submitted_at,
            'reviewed_at' => $this->reviewed_at,
            'employee' => $this->whenLoaded('employee', fn () => [
                'id' => $this->employee->id,
                'employee_number' => $this->employee->employee_number,
                'full_name' => trim($this->employee->first_name.' '.$this->employee->last_name),
                'work_email' => $this->employee->work_email,
            ]),
            'document_type' => $this->whenLoaded('documentType', fn () => [
                'id' => $this->documentType->id,
                'code' => $this->documentType->code,
                'name' => $this->documentType->name,
                'requires_expiry_date' => $this->documentType->requires_expiry_date,
            ]),
            'requirement' => $this->whenLoaded('requirement', fn () => $this->requirement ? [
                'id' => $this->requirement->id,
                'name' => $this->requirement->name,
                'is_required' => $this->requirement->is_required,
            ] : null),
            'uploaded_by' => $this->whenLoaded('uploadedBy', fn () => $this->uploadedBy ? [
                'id' => $this->uploadedBy->id,
                'name' => $this->uploadedBy->name,
                'email' => $this->uploadedBy->email,
            ] : null),
            'reviewed_by' => $this->whenLoaded('reviewedBy', fn () => $this->reviewedBy ? [
                'id' => $this->reviewedBy->id,
                'name' => $this->reviewedBy->name,
                'email' => $this->reviewedBy->email,
            ] : null),
            'reviews' => EmployeeDocumentReviewResource::collection($this->whenLoaded('reviews')),
            'approval_requests' => ApprovalRequestResource::collection($this->whenLoaded('approvalRequests')),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
