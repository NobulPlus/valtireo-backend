<?php

namespace App\Http\Requests\Platform;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Platform-only curation of the global permission catalog's display
 * metadata. `name` (the code key every can() check depends on) is
 * deliberately absent from these rules — there is no validation path that
 * would let it through, not just a convention against sending it.
 */
class UpdatePermissionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->is_platform_admin === true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'label' => ['sometimes', 'nullable', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'group' => ['sometimes', 'nullable', 'string', 'max:100'],
        ];
    }
}
