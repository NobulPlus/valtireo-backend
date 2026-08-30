<?php

namespace App\Http\Requests\ServiceDesk;

use Illuminate\Foundation\Http\FormRequest;

class ReopenTicketRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('service_desk.view') === true;
    }

    public function rules(): array
    {
        return [
            'reason' => ['required', 'string', 'max:2000'],
        ];
    }
}
