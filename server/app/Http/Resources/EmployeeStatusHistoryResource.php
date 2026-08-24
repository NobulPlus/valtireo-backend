<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\EmployeeStatusHistory */
class EmployeeStatusHistoryResource extends JsonResource
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
            'previous_status' => $this->previous_status,
            'new_status' => $this->new_status,
            'previous_confirmation_status' => $this->previous_confirmation_status,
            'new_confirmation_status' => $this->new_confirmation_status,
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
}
