<?php

namespace App\Http\Requests\Leave;

use Illuminate\Foundation\Http\FormRequest;

class UpdateLeavePeriodRequest extends FormRequest
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
            'name' => ['sometimes', 'string', 'max:255'],
            'starts_on' => ['sometimes', 'date'],
            'ends_on' => ['sometimes', 'date'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
