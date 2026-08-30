<?php

namespace App\Http\Requests\ServiceDesk;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreTicketRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('service_desk.create') === true
            || $this->user()?->can('service_desk.view') === true;
    }

    public function rules(): array
    {
        return [
            'ticket_category_id' => [
                'required',
                'integer',
                Rule::exists('ticket_categories', 'id')->where(fn ($query) => $query
                    ->where('organization_id', $this->user()?->organization_id)
                    ->where('is_active', true)),
            ],
            'subject' => ['required', 'string', 'max:150'],
            'description' => ['required', 'string', 'max:4000'],
            'priority' => ['sometimes', Rule::in(['low', 'medium', 'high', 'urgent'])],
            'assigned_to_user_id' => [
                'nullable',
                'integer',
                Rule::exists('users', 'id')->where('organization_id', $this->user()?->organization_id),
            ],
            'department_id' => [
                'nullable',
                'integer',
                Rule::exists('departments', 'id')->where(fn ($query) => $query
                    ->where('organization_id', $this->user()?->organization_id)
                    ->where('is_active', true)),
            ],
            'asset_id' => [
                'nullable',
                'integer',
                Rule::exists('assets', 'id')->where(fn ($query) => $query
                    ->where('organization_id', $this->user()?->organization_id)
                    ->where('assigned_to_employee_id', $this->user()?->employee?->id)),
            ],
            'attachment' => ['nullable', 'file', 'max:5120', 'mimes:pdf,jpg,jpeg,png,doc,docx'],
        ];
    }
}
