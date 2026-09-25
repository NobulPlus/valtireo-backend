<?php

namespace App\Http\Requests\Platform;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateOrganizationModuleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->is_platform_admin ?? false;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'status' => ['required', Rule::in(['active', 'trial', 'suspended'])],
            'duration' => ['required_unless:status,suspended', Rule::in(['forever', 'one_year', 'custom'])],
            'expires_at' => ['required_if:duration,custom', 'nullable', 'date', 'after:today'],
        ];
    }
}
