<?php

namespace App\Http\Requests\Documents;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ReviewEmployeeDocumentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('employee_documents.update') === true;
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
