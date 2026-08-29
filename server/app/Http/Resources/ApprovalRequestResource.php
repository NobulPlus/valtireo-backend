<?php

namespace App\Http\Resources;

use App\Models\EmployeeDocument;
use App\Models\LeaveRequest;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\ApprovalRequest */
class ApprovalRequestResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'organization_id' => $this->organization_id,
            'approval_workflow_id' => $this->approval_workflow_id,
            'requester' => $this->whenLoaded('requester', fn () => $this->requester ? [
                'id' => $this->requester->id,
                'name' => $this->requester->name,
                'email' => $this->requester->email,
            ] : null),
            'subject_employee' => $this->whenLoaded('subjectEmployee', fn () => $this->subjectEmployee ? [
                'id' => $this->subjectEmployee->id,
                'employee_number' => $this->subjectEmployee->employee_number,
                'full_name' => trim($this->subjectEmployee->first_name.' '.$this->subjectEmployee->last_name),
                'work_email' => $this->subjectEmployee->work_email,
            ] : null),
            'approvable_type' => $this->approvable_type,
            'approvable_id' => $this->approvable_id,
            'module' => $this->module,
            'action' => $this->action,
            'title' => $this->title,
            'status' => $this->status,
            'current_step_order' => $this->current_step_order,
            'submitted_at' => $this->submitted_at,
            'completed_at' => $this->completed_at,
            'metadata' => $this->metadata ?? [],
            // So the reviewer can actually see the file before deciding —
            // not every approvable type has one, only documents do.
            'document' => $this->whenLoaded('approvable', fn () => $this->approvable instanceof EmployeeDocument ? [
                'id' => $this->approvable->id,
                'title' => $this->approvable->title,
                'file_name' => $this->approvable->file_name,
                'mime_type' => $this->approvable->mime_type,
                'download_url' => url("/api/documents/{$this->approvable->id}/download"),
                'view_url' => url("/api/documents/{$this->approvable->id}/view"),
            ] : null),
            'leave_request' => $this->whenLoaded('approvable', fn () => $this->approvable instanceof LeaveRequest ? [
                'id' => $this->approvable->id,
                'evidence_file_name' => $this->approvable->evidence_file_name,
                'evidence_mime_type' => $this->approvable->evidence_mime_type,
                'evidence_file_size' => $this->approvable->evidence_file_size,
                'evidence_download_url' => $this->approvable->evidence_file_path ? url("/api/leave/requests/{$this->approvable->id}/evidence/download") : null,
            ] : null),
            'workflow' => new ApprovalWorkflowResource($this->whenLoaded('workflow')),
            'decisions' => ApprovalDecisionResource::collection($this->whenLoaded('decisions')),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
