<?php

namespace App\Http\Requests\Documents;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreDocumentRequirementRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('employee_documents.create') === true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $organizationId = $this->user()?->organization_id;

        return [
            'document_type_id' => ['required', Rule::exists('document_types', 'id')->where('organization_id', $organizationId)],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:1000'],
            'is_required' => ['sometimes', 'boolean'],
            'employee_upload_allowed' => ['sometimes', 'boolean'],
            'approval_required' => ['sometimes', 'boolean'],
            'reminder_days' => ['sometimes', 'integer', 'min:0', 'max:365'],
            'department_id' => ['nullable', Rule::exists('departments', 'id')->where('organization_id', $organizationId)],
            'designation_id' => ['nullable', Rule::exists('designations', 'id')->where('organization_id', $organizationId)],
            'grade_level_id' => ['nullable', Rule::exists('grade_levels', 'id')->where('organization_id', $organizationId)],
            'employment_type_id' => ['nullable', Rule::exists('employment_types', 'id')->where('organization_id', $organizationId)],
            'organization_location_id' => ['nullable', Rule::exists('organization_locations', 'id')->where('organization_id', $organizationId)],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
