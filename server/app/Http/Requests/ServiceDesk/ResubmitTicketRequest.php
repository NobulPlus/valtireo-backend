<?php

namespace App\Http\Requests\ServiceDesk;

use App\Http\Requests\ServiceDesk\Concerns\AuthorizesServiceDeskAccess;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ResubmitTicketRequest extends FormRequest
{
    use AuthorizesServiceDeskAccess;

    public function authorize(): bool
    {
        return $this->hasServiceDeskAccess();
    }

    public function rules(): array
    {
        return [
            'ticket_category_id' => [
                'sometimes',
                'integer',
                Rule::exists('ticket_categories', 'id')->where(fn ($query) => $query
                    ->where('organization_id', $this->user()?->organization_id)
                    ->where('is_active', true)),
            ],
            'subject' => ['sometimes', 'string', 'max:150'],
            'description' => ['sometimes', 'string', 'max:4000'],
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
            'attachment' => ['nullable', 'file', 'max:5120', 'mimes:pdf,jpg,jpeg,png,doc,docx'],
        ];
    }
}
