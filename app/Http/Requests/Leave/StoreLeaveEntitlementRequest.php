<?php

namespace App\Http\Requests\Leave;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreLeaveEntitlementRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('leave_requests.approve') === true;
    }

    public function rules(): array
    {
        $organizationId = $this->user()?->organization_id;

        return [
            'employee_id' => ['required', Rule::exists('employees', 'id')->where('organization_id', $organizationId)],
            'leave_type_id' => ['required', Rule::exists('leave_types', 'id')->where('organization_id', $organizationId)],
            'leave_period_id' => ['required', Rule::exists('leave_periods', 'id')->where('organization_id', $organizationId)],
            'days_allocated' => ['required', 'numeric', 'min:0', 'max:366'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
