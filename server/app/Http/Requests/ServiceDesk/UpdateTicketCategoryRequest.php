<?php

namespace App\Http\Requests\ServiceDesk;

use App\Models\TicketCategory;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateTicketCategoryRequest extends FormRequest
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
        /** @var TicketCategory|null $ticketCategory */
        $ticketCategory = $this->route('ticketCategory');

        return [
            'name' => ['sometimes', 'string', 'max:255'],
            'code' => [
                'sometimes',
                'alpha_dash',
                'max:50',
                Rule::unique('ticket_categories', 'code')
                    ->where('organization_id', $this->user()?->organization_id)
                    ->ignore($ticketCategory?->id),
            ],
            'description' => ['nullable', 'string', 'max:1000'],
            'is_active' => ['sometimes', 'boolean'],
            'response_sla_hours' => ['nullable', 'integer', 'min:1', 'max:65535'],
            'resolution_sla_hours' => ['nullable', 'integer', 'min:1', 'max:65535'],
        ];
    }
}
