<?php

namespace App\Http\Requests\Documents;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreDocumentTypeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('employee_documents.create') === true;
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('code')) {
            $this->merge(['code' => strtoupper((string) $this->input('code'))]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'code' => [
                'required',
                'alpha_dash',
                'max:50',
                Rule::unique('document_types', 'code')->where('organization_id', $this->user()?->organization_id),
            ],
            'description' => ['nullable', 'string', 'max:1000'],
            'requires_expiry_date' => ['sometimes', 'boolean'],
            'default_reminder_days' => ['sometimes', 'integer', 'min:0', 'max:365'],
            'employee_upload_allowed' => ['sometimes', 'boolean'],
            'approval_required' => ['sometimes', 'boolean'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
