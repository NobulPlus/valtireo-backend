<?php

namespace App\Http\Requests\ServiceDesk;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateTicketPriorityRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('service_desk.view') === true;
    }

    public function rules(): array
    {
        return [
            'priority' => ['required', Rule::in(['low', 'medium', 'high', 'urgent'])],
        ];
    }
}
