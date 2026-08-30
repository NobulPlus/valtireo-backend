<?php

namespace App\Http\Requests\ServiceDesk;

use Illuminate\Foundation\Http\FormRequest;

class CancelTicketRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('service_desk.cancel') === true
            || $this->user()?->can('service_desk.view') === true;
    }

    public function rules(): array
    {
        return [];
    }
}
