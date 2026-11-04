<?php

namespace App\Http\Requests\Attendance;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreAttendanceRecordRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Recording your own attendance is baseline employee self-service, not a
        // role-gated capability — mirrors StoreLeaveRequestRequest's fallback.
        // AttendanceService::targetEmployee() already restricts a caller without
        // attendance.update to only their own employee_id, so this fallback can't
        // let anyone record attendance for someone else.
        return $this->user()?->can('attendance.create') === true
            || $this->user()?->can('attendance.update') === true
            || $this->user()?->employee?->status === 'active';
    }

    public function rules(): array
    {
        $organizationId = $this->user()?->organization_id;

        return [
            'employee_id' => ['nullable', Rule::exists('employees', 'id')->where('organization_id', $organizationId)],
            'work_shift_id' => ['nullable', Rule::exists('work_shifts', 'id')->where('organization_id', $organizationId)],
            'attendance_date' => ['required', 'date'],
            'check_in_at' => ['nullable', 'date'],
            'check_out_at' => ['nullable', 'date', 'after_or_equal:check_in_at'],
            'source' => ['sometimes', Rule::in(['manual', 'employee', 'import', 'device'])],
            'status' => ['sometimes', Rule::in(['present', 'absent', 'late', 'half_day', 'corrected'])],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
