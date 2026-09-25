<?php

namespace App\Http\Requests\Employees;

use Illuminate\Foundation\Http\FormRequest;

class UpsertEmployeeCustomFieldValuesRequest extends FormRequest
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
            'values' => ['required', 'array', 'min:1'],
            'values.*.field_id' => ['nullable', 'integer'],
            'values.*.key' => ['nullable', 'string', 'max:100'],
            'values.*.value' => ['nullable'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator): void {
            foreach ($this->input('values', []) as $index => $item) {
                if (empty($item['field_id']) && empty($item['key'])) {
                    $validator->errors()->add("values.{$index}.field_id", 'Either field_id or key is required.');
                }
            }
        });
    }
}
