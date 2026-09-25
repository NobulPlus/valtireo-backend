<?php

namespace App\Http\Requests\Platform;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ReviewOrganizationVerificationDocumentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->is_platform_admin ?? false;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'action' => ['required', Rule::in(['approve', 'reject', 'request_changes'])],
            'note' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
