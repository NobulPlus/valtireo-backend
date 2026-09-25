<?php

namespace App\Http\Requests\Calendar;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateCompanyEventRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $organizationId = $this->user()?->organization_id;

        return [
            'department_id' => ['sometimes', 'nullable', Rule::exists('departments', 'id')->where('organization_id', $organizationId)],
            'title' => ['sometimes', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'starts_on' => ['sometimes', 'date'],
            'ends_on' => ['sometimes', 'date'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
