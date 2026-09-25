<?php

namespace App\Http\Requests\Platform;

use App\Services\OrganizationVerificationService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreOrganizationVerificationDocumentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('workspace_settings.update') === true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'document_type' => ['required', Rule::in([
                ...OrganizationVerificationService::REQUIRED_DOCUMENT_TYPES,
                ...OrganizationVerificationService::OPTIONAL_DOCUMENT_TYPES,
            ])],
            'title' => ['required', 'string', 'max:255'],
            'file' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png,webp,doc,docx', 'max:10240'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
