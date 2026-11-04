<?php

namespace App\Http\Requests\Attendance;

use Illuminate\Foundation\Http\FormRequest;

class StoreAttendanceCorrectionRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Requesting a correction to your own attendance is baseline self-service,
        // not a role-gated capability — mirrors StoreLeaveRequestRequest's and
        // StoreAttendanceRecordRequest's fallback. AttendanceService::requestCorrection()
        // already rejects a caller without attendance.update whose employee_id
        // doesn't match the record, so this fallback can't target someone else's record.
        return $this->user()?->can('attendance.create') === true
            || $this->user()?->can('attendance.update') === true
            || $this->user()?->employee?->status === 'active';
    }

    public function rules(): array
    {
        return [
            'attendance_record_id' => ['required', 'integer'],
            'timezone' => ['sometimes', 'timezone'],
            'requested_check_in_at' => ['nullable', 'date'],
            'requested_check_out_at' => ['nullable', 'date', 'after_or_equal:requested_check_in_at'],
            'reason' => ['required', 'string', 'max:2000'],
        ];
    }
}
