<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\LeaveRequest */
class LeaveRequestResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'organization_id' => $this->organization_id,
            'employee_id' => $this->employee_id,
            'leave_type_id' => $this->leave_type_id,
            'leave_period_id' => $this->leave_period_id,
            'requested_by_id' => $this->requested_by_id,
            'starts_on' => $this->starts_on,
            'ends_on' => $this->ends_on,
            'total_days' => (float) $this->total_days,
            'status' => $this->status,
            'reason' => $this->reason,
            'evidence_file_name' => $this->evidence_file_name,
            'evidence_mime_type' => $this->evidence_mime_type,
            'evidence_file_size' => $this->evidence_file_size,
            'evidence_download_url' => $this->evidence_file_path ? url("/api/leave/requests/{$this->id}/evidence/download") : null,
            'submitted_at' => $this->submitted_at,
            'reviewed_at' => $this->reviewed_at,
            'employee' => $this->whenLoaded('employee', fn () => [
                'id' => $this->employee->id,
                'employee_number' => $this->employee->employee_number,
                'full_name' => trim($this->employee->first_name.' '.$this->employee->last_name),
                'work_email' => $this->employee->work_email,
            ]),
            'leave_type' => new LeaveTypeResource($this->whenLoaded('leaveType')),
            'leave_period' => new LeavePeriodResource($this->whenLoaded('leavePeriod')),
            'requested_by' => $this->whenLoaded('requestedBy', fn () => $this->requestedBy ? [
                'id' => $this->requestedBy->id,
                'name' => $this->requestedBy->name,
                'email' => $this->requestedBy->email,
            ] : null),
            'comments' => LeaveRequestCommentResource::collection($this->whenLoaded('comments')),
            'approval_requests' => ApprovalRequestResource::collection($this->whenLoaded('approvalRequests')),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
