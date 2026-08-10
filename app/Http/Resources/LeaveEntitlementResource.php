<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\LeaveEntitlement */
class LeaveEntitlementResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $allocated = (float) $this->days_allocated;
        $used = (float) $this->days_used;
        $pending = (float) $this->days_pending;

        return [
            'id' => $this->id,
            'organization_id' => $this->organization_id,
            'employee_id' => $this->employee_id,
            'leave_type_id' => $this->leave_type_id,
            'leave_period_id' => $this->leave_period_id,
            'days_allocated' => $allocated,
            'days_used' => $used,
            'days_pending' => $pending,
            'days_available' => max($allocated - $used - $pending, 0),
            'notes' => $this->notes,
            'employee' => $this->whenLoaded('employee', fn () => [
                'id' => $this->employee->id,
                'employee_number' => $this->employee->employee_number,
                'full_name' => trim($this->employee->first_name.' '.$this->employee->last_name),
                'work_email' => $this->employee->work_email,
            ]),
            'leave_type' => new LeaveTypeResource($this->whenLoaded('leaveType')),
            'leave_period' => new LeavePeriodResource($this->whenLoaded('leavePeriod')),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
