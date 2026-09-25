<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\ApprovalDecision */
class ApprovalDecisionResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'approval_request_id' => $this->approval_request_id,
            'approval_workflow_step_id' => $this->approval_workflow_step_id,
            'actor' => $this->whenLoaded('actor', fn () => $this->actor ? [
                'id' => $this->actor->id,
                'name' => $this->actor->name,
                'email' => $this->actor->email,
            ] : null),
            'action' => $this->action,
            'previous_status' => $this->previous_status,
            'next_status' => $this->next_status,
            'note' => $this->note,
            'metadata' => $this->metadata ?? [],
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
