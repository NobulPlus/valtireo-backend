<?php

namespace App\Http\Requests\Leave;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class BulkGrantLeaveEntitlementRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('leave_requests.approve') === true;
    }

    public function rules(): array
    {
        $organizationId = $this->user()?->organization_id;

        return [
            'leave_type_id' => ['required', Rule::exists('leave_types', 'id')->where('organization_id', $organizationId)],
            'leave_period_id' => ['required', Rule::exists('leave_periods', 'id')->where('organization_id', $organizationId)],
            'days_allocated' => ['nullable', 'numeric', 'min:0', 'max:366'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
