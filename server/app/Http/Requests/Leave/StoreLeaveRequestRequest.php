<?php

namespace App\Http\Requests\Leave;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreLeaveRequestRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('leave_requests.create') === true
            || $this->user()?->can('leave_requests.approve') === true;
    }

    public function rules(): array
    {
        $organizationId = $this->user()?->organization_id;

        return [
            'employee_id' => ['nullable', Rule::exists('employees', 'id')->where('organization_id', $organizationId)],
            'leave_type_id' => ['required', Rule::exists('leave_types', 'id')->where('organization_id', $organizationId)],
            'starts_on' => ['required', 'date'],
            'ends_on' => ['required', 'date', 'after_or_equal:starts_on'],
            'reason' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
