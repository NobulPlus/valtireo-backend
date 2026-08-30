<?php

namespace App\Http\Requests\ServiceDesk;

use Illuminate\Foundation\Http\FormRequest;

class StartTicketRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('service_desk.view') === true;
    }

    public function rules(): array
    {
        return [
            'note' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
