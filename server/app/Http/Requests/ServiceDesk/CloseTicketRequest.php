<?php

namespace App\Http\Requests\ServiceDesk;

use Illuminate\Foundation\Http\FormRequest;

class CloseTicketRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('service_desk.view') === true
            || $this->user()?->can('service_desk.create') === true;
    }

    public function rules(): array
    {
        return [
            'satisfaction_rating' => ['nullable', 'integer', 'min:1', 'max:5'],
            'satisfaction_comment' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
