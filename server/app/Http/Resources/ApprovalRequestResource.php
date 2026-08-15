<?php

namespace App\Http\Resources;

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
            'workflow' => new ApprovalWorkflowResource($this->whenLoaded('workflow')),
            'decisions' => ApprovalDecisionResource::collection($this->whenLoaded('decisions')),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
