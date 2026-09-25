<?php

namespace App\Http\Requests\Employees;

use App\Models\EmployeeCustomField;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateEmployeeCustomFieldRequest extends FormRequest
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
        /** @var EmployeeCustomField|null $field */
        $field = $this->route('customField');

        return [
            'name' => ['sometimes', 'string', 'max:255'],
            'key' => [
                'sometimes',
                'string',
                'max:100',
                'regex:/^[a-z0-9_]+$/',
                Rule::unique('employee_custom_fields', 'key')
                    ->where('organization_id', $this->user()?->organization_id)
                    ->ignore($field?->id),
            ],
            'type' => ['sometimes', Rule::in(['text', 'textarea', 'number', 'date', 'boolean', 'select', 'multi_select'])],
            'options' => ['nullable', 'array'],
            'is_required' => ['sometimes', 'boolean'],
            'visible_to_employee' => ['sometimes', 'boolean'],
            'editable_by_employee' => ['sometimes', 'boolean'],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
        ];
    }
}
