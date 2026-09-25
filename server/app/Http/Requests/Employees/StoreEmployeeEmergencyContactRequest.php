<?php

namespace App\Http\Requests\Employees;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreEmployeeEmergencyContactRequest extends FormRequest
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
            'employee_id' => ['nullable', Rule::exists('employees', 'id')->where('organization_id', $this->user()?->organization_id)],
            'name' => ['required', 'string', 'max:255'],
            'relationship' => ['nullable', 'string', 'max:100'],
            'phone' => ['required', 'string', 'max:50'],
            'alternate_phone' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email', 'max:255'],
            'address' => ['nullable', 'string', 'max:1000'],
            'is_primary' => ['sometimes', 'boolean'],
        ];
    }
}
