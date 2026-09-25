<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\AttendanceSetting */
class AttendanceSettingResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'organization_id' => $this->organization_id,
            'timezone' => $this->timezone,
            'late_grace_minutes' => $this->late_grace_minutes,
            'early_checkout_grace_minutes' => $this->early_checkout_grace_minutes,
            'rounding_minutes' => $this->rounding_minutes,
            'allow_employee_clock_in' => $this->allow_employee_clock_in,
            'allow_employee_corrections' => $this->allow_employee_corrections,
            'require_approval_for_corrections' => $this->require_approval_for_corrections,
            'allowed_sources' => $this->allowed_sources ?? [],
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
