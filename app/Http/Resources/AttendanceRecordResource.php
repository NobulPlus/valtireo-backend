<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\AttendanceRecord */
class AttendanceRecordResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'organization_id' => $this->organization_id,
            'employee_id' => $this->employee_id,
            'work_shift_id' => $this->work_shift_id,
            'attendance_date' => $this->attendance_date,
            'check_in_at' => $this->check_in_at,
            'check_out_at' => $this->check_out_at,
            'duration_minutes' => $this->duration_minutes,
            'source' => $this->source,
            'status' => $this->status,
            'notes' => $this->notes,
            'employee' => $this->whenLoaded('employee', fn () => [
                'id' => $this->employee->id,
                'employee_number' => $this->employee->employee_number,
                'full_name' => trim($this->employee->first_name.' '.$this->employee->last_name),
                'work_email' => $this->employee->work_email,
            ]),
            'work_shift' => new WorkShiftResource($this->whenLoaded('workShift')),
            'recorded_by' => $this->whenLoaded('recordedBy', fn () => $this->recordedBy ? [
                'id' => $this->recordedBy->id,
                'name' => $this->recordedBy->name,
                'email' => $this->recordedBy->email,
            ] : null),
            'correction_requests' => AttendanceCorrectionRequestResource::collection($this->whenLoaded('correctionRequests')),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
