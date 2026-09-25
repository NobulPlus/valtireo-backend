<?php

namespace App\Http\Requests\ServiceDesk;

use App\Http\Requests\ServiceDesk\Concerns\AuthorizesServiceDeskAccess;
use Illuminate\Foundation\Http\FormRequest;

class CloseTicketRequest extends FormRequest
{
    use AuthorizesServiceDeskAccess;

    public function authorize(): bool
    {
        return $this->hasServiceDeskAccess();
    }

    public function rules(): array
    {
        return [
            'satisfaction_rating' => ['nullable', 'integer', 'min:1', 'max:5'],
            'satisfaction_comment' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
