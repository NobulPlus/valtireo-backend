<?php

namespace App\Http\Requests\Employees;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreEmployeeStatusHistoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('employees.update') === true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'new_status' => ['required', Rule::in(['draft', 'invited', 'onboarding', 'active', 'probation', 'confirmed', 'suspended', 'exited'])],
            'effective_date' => ['required', 'date'],
            'reason' => ['nullable', 'string', 'max:1000'],
            'note' => ['nullable', 'string', 'max:2000'],
            'probation_ends_at' => [
                Rule::requiredIf($this->input('new_status') === 'probation'),
                'nullable',
                'date',
                'after:effective_date',
            ],
        ];
    }
}
