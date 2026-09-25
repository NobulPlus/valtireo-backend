<?php

namespace App\Http\Requests\ServiceDesk;

use App\Http\Requests\ServiceDesk\Concerns\AuthorizesServiceDeskAccess;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AddTicketCommentRequest extends FormRequest
{
    use AuthorizesServiceDeskAccess;

    public function authorize(): bool
    {
        // Coarse gate only — whether this specific ticket belongs to the
        // actor (or they hold service_desk.view) is a per-ticket check the
        // service performs, mirroring cancel/assign/resolve/reopen.
        return $this->hasServiceDeskAccess();
    }

    public function rules(): array
    {
        return [
            'comment' => ['required', 'string', 'max:4000'],
            'visibility' => ['nullable', Rule::in(['public', 'internal'])],
            'attachment' => ['nullable', 'file', 'max:5120', 'mimes:jpg,jpeg,png,pdf,doc,docx,xls,xlsx,csv'],
        ];
    }
}
