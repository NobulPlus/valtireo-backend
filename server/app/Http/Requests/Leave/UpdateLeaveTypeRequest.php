<?php

namespace App\Http\Requests\Leave;

use App\Models\LeaveType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateLeaveTypeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('leave_requests.approve') === true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        /** @var LeaveType|null $leaveType */
        $leaveType = $this->route('leaveType');

        return [
            'name' => ['sometimes', 'string', 'max:255'],
            'code' => [
                'sometimes',
                'string',
                'max:50',
                Rule::unique('leave_types', 'code')
                    ->where('organization_id', $this->user()?->organization_id)
                    ->ignore($leaveType?->id),
            ],
            'description' => ['nullable', 'string', 'max:1000'],
            'default_days_per_year' => ['nullable', 'integer', 'min:0', 'max:365'],
            'auto_grant_on_activation' => ['sometimes', 'boolean'],
            'is_paid' => ['sometimes', 'boolean'],
            'requires_attachment' => ['sometimes', 'boolean'],
            'minimum_notice_days' => ['sometimes', 'integer', 'min:0', 'max:365'],
            'maximum_days_per_request' => ['nullable', 'integer', 'min:1', 'max:365'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
