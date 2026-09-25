<?php

namespace App\Http\Requests\Attendance;

use Illuminate\Foundation\Http\FormRequest;

class UpdateAttendanceSettingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('attendance.update') === true;
    }

    public function rules(): array
    {
        return [
            'timezone' => ['sometimes', 'string', 'max:100'],
            'late_grace_minutes' => ['sometimes', 'integer', 'min:0', 'max:240'],
            'early_checkout_grace_minutes' => ['sometimes', 'integer', 'min:0', 'max:240'],
            'rounding_minutes' => ['sometimes', 'integer', 'min:0', 'max:60'],
            'allow_employee_clock_in' => ['sometimes', 'boolean'],
            'allow_employee_corrections' => ['sometimes', 'boolean'],
            'require_approval_for_corrections' => ['sometimes', 'boolean'],
            'allowed_sources' => ['nullable', 'array'],
            'allowed_sources.*' => ['string', 'max:50'],
        ];
    }
}
