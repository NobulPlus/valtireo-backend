<?php

namespace App\Http\Requests\ServiceDesk;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class EscalateTicketRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('service_desk.view') === true;
    }

    public function rules(): array
    {
        return [
            'assigned_to_user_id' => ['nullable', 'integer', 'exists:users,id'],
            'priority' => ['nullable', Rule::in(['high', 'urgent'])],
            'note' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
