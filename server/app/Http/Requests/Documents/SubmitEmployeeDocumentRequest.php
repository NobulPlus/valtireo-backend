<?php

namespace App\Http\Requests\Documents;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SubmitEmployeeDocumentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('employee_documents.create') === true
            || $this->user()?->employee !== null;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $organizationId = $this->user()?->organization_id;

        return [
            'employee_id' => ['nullable', Rule::exists('employees', 'id')->where('organization_id', $organizationId)],
            'document_type_id' => ['required', Rule::exists('document_types', 'id')->where('organization_id', $organizationId)],
            'document_requirement_id' => ['nullable', Rule::exists('document_requirements', 'id')->where('organization_id', $organizationId)],
            'title' => ['required', 'string', 'max:255'],
            'file' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png,webp,doc,docx', 'max:10240'],
            'file_name' => ['nullable', 'string', 'max:255'],
            'mime_type' => ['nullable', 'string', 'max:120'],
            'file_size' => ['nullable', 'integer', 'min:1'],
            'issued_at' => ['nullable', 'date'],
            'expires_at' => ['nullable', 'date', 'after_or_equal:issued_at'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
