<?php

namespace App\Http\Requests\Attendance;

use Illuminate\Foundation\Http\FormRequest;

class StoreAttendanceCorrectionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('attendance.create') === true
            || $this->user()?->can('attendance.update') === true;
    }

    public function rules(): array
    {
        return [
            'attendance_record_id' => ['required', 'integer'],
            'requested_check_in_at' => ['nullable', 'date'],
            'requested_check_out_at' => ['nullable', 'date', 'after_or_equal:requested_check_in_at'],
            'reason' => ['required', 'string', 'max:2000'],
        ];
    }
}
