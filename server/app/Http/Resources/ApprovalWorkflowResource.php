<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\ApprovalWorkflow */
class ApprovalWorkflowResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'organization_id' => $this->organization_id,
            'module' => $this->module,
            'action' => $this->action,
            'name' => $this->name,
            'description' => $this->description,
            'is_active' => $this->is_active,
            'require_note_on_reject' => $this->require_note_on_reject,
            'require_note_on_request_changes' => $this->require_note_on_request_changes,
            'auto_approve_when_no_steps' => $this->auto_approve_when_no_steps,
            'conditions' => $this->conditions ?? [],
            'steps' => ApprovalWorkflowStepResource::collection($this->whenLoaded('steps')),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
