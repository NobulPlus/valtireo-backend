<?php

namespace App\Http\Requests\Employees;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ApproveEmployeeOnboardingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('employees.update') ?? false;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'new_status' => ['required', Rule::in(['active', 'probation', 'confirmed'])],
            'probation_ends_at' => [
                Rule::requiredIf($this->input('new_status') === 'probation'),
                'nullable',
                'date',
                'after:today',
            ],
        ];
    }
}
