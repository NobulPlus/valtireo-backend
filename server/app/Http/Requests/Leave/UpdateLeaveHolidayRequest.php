<?php

namespace App\Http\Requests\Leave;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateLeaveHolidayRequest extends FormRequest
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
        return [
            'organization_location_id' => ['nullable', Rule::exists('organization_locations', 'id')->where('organization_id', $this->user()?->organization_id)],
            'name' => ['sometimes', 'string', 'max:255'],
            'date' => ['sometimes', 'date'],
            'is_recurring' => ['sometimes', 'boolean'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
