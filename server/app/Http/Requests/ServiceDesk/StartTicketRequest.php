<?php

namespace App\Http\Requests\ServiceDesk;

use App\Http\Requests\ServiceDesk\Concerns\AuthorizesServiceDeskAccess;
use Illuminate\Foundation\Http\FormRequest;

class StartTicketRequest extends FormRequest
{
    use AuthorizesServiceDeskAccess;

    public function authorize(): bool
    {
        return $this->hasServiceDeskAccess();
    }

    public function rules(): array
    {
        return [
            'note' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
