<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\AttendanceCorrectionRequest */
class AttendanceCorrectionRequestResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'organization_id' => $this->organization_id,
            'attendance_record_id' => $this->attendance_record_id,
            'employee_id' => $this->employee_id,
            'requested_by_id' => $this->requested_by_id,
            'original_check_in_at' => $this->original_check_in_at,
            'original_check_out_at' => $this->original_check_out_at,
            'requested_check_in_at' => $this->requested_check_in_at,
            'requested_check_out_at' => $this->requested_check_out_at,
            'status' => $this->status,
            'reason' => $this->reason,
            'submitted_at' => $this->submitted_at,
            'reviewed_at' => $this->reviewed_at,
            'employee' => $this->whenLoaded('employee', fn () => [
                'id' => $this->employee->id,
                'employee_number' => $this->employee->employee_number,
                'full_name' => trim($this->employee->first_name.' '.$this->employee->last_name),
            ]),
            'attendance_record' => new AttendanceRecordResource($this->whenLoaded('attendanceRecord')),
            'approval_requests' => ApprovalRequestResource::collection($this->whenLoaded('approvalRequests')),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
