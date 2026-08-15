<?php

namespace App\Http\Requests\Employees;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreEmployeeCustomFieldRequest extends FormRequest
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
            'name' => ['required', 'string', 'max:255'],
            'key' => [
                'required',
                'string',
                'max:100',
                'regex:/^[a-z0-9_]+$/',
                Rule::unique('employee_custom_fields', 'key')->where('organization_id', $this->user()?->organization_id),
            ],
            'type' => ['required', Rule::in(['text', 'textarea', 'number', 'date', 'boolean', 'select', 'multi_select'])],
            'options' => ['nullable', 'array'],
            'is_required' => ['sometimes', 'boolean'],
            'visible_to_employee' => ['sometimes', 'boolean'],
            'editable_by_employee' => ['sometimes', 'boolean'],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
        ];
    }
}
