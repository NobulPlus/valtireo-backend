<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\ApprovalWorkflowStep */
class ApprovalWorkflowStepResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'approval_workflow_id' => $this->approval_workflow_id,
            'step_order' => $this->step_order,
            'name' => $this->name,
            'approver_type' => $this->approver_type,
            'approver_role' => $this->approver_role,
            'approver_permission' => $this->approver_permission,
            'note_required' => $this->note_required,
            'is_active' => $this->is_active,
            'settings' => $this->settings ?? [],
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
