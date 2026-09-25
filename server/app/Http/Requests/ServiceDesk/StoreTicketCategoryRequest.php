<?php

namespace App\Http\Requests\ServiceDesk;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreTicketCategoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('service_desk.view') === true;
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
                Rule::unique('ticket_categories', 'code')->where('organization_id', $this->user()?->organization_id),
            ],
            'description' => ['nullable', 'string', 'max:1000'],
            'is_active' => ['sometimes', 'boolean'],
            'response_sla_hours' => ['nullable', 'integer', 'min:1', 'max:65535'],
            'resolution_sla_hours' => ['nullable', 'integer', 'min:1', 'max:65535'],
        ];
    }
}
