<?php

namespace App\Http\Requests\Platform;

use Illuminate\Foundation\Http\FormRequest;

class UpdateOrganizationWorkspaceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasRole('Super Admin') ?? false;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'string', 'max:255'],
            'support_email' => ['sometimes', 'nullable', 'email', 'max:255'],
            'timezone' => ['sometimes', 'timezone'],
        ];
    }
}
