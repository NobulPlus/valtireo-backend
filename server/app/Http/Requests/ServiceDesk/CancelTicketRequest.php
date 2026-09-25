<?php

namespace App\Http\Requests\ServiceDesk;

use App\Http\Requests\ServiceDesk\Concerns\AuthorizesServiceDeskAccess;
use Illuminate\Foundation\Http\FormRequest;

class CancelTicketRequest extends FormRequest
{
    use AuthorizesServiceDeskAccess;

    public function authorize(): bool
    {
        return $this->user()?->can('service_desk.cancel') === true
            || $this->hasServiceDeskAccess();
    }

    public function rules(): array
    {
        return [];
    }
}
