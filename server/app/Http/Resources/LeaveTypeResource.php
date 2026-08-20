<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\LeaveType */
class LeaveTypeResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'organization_id' => $this->organization_id,
            'name' => $this->name,
            'code' => $this->code,
            'description' => $this->description,
            'default_days_per_year' => $this->default_days_per_year,
            'auto_grant_on_activation' => $this->auto_grant_on_activation,
            'is_paid' => $this->is_paid,
            'requires_attachment' => $this->requires_attachment,
            'minimum_notice_days' => $this->minimum_notice_days,
            'maximum_days_per_request' => $this->maximum_days_per_request,
            'is_active' => $this->is_active,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
