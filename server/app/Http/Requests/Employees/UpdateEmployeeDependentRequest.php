<?php

namespace App\Http\Requests\Employees;

use Illuminate\Foundation\Http\FormRequest;

class UpdateEmployeeDependentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('employees.update') === true
            || $this->user()?->employee !== null;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'string', 'max:255'],
            'relationship' => ['sometimes', 'string', 'max:100'],
            'date_of_birth' => ['nullable', 'date'],
            'gender' => ['nullable', 'string', 'max:50'],
            'phone' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email', 'max:255'],
            'address' => ['nullable', 'string', 'max:1000'],
            'is_beneficiary' => ['sometimes', 'boolean'],
        ];
    }
}
