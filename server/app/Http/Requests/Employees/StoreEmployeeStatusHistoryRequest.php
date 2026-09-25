<?php

namespace App\Http\Requests\Employees;

use Illuminate\Contracts\Validation\Validator;
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
            'new_status' => ['sometimes', Rule::in(['draft', 'invited', 'onboarding', 'active', 'suspended', 'exited'])],
            'new_confirmation_status' => ['sometimes', Rule::in(['not_applicable', 'probation', 'confirmed'])],
            'effective_date' => ['required', 'date'],
            'reason' => ['nullable', 'string', 'max:1000'],
            'note' => ['nullable', 'string', 'max:2000'],
            'probation_ends_at' => [
                Rule::requiredIf($this->input('new_confirmation_status') === 'probation'),
                'nullable',
                'date',
                'after:effective_date',
            ],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if (! $this->has('new_status') && ! $this->has('new_confirmation_status')) {
                $validator->errors()->add('new_status', 'Provide a new employment status, a new confirmation status, or both.');
            }
        });
    }
}
