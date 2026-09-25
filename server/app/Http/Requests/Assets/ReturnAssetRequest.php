<?php

namespace App\Http\Requests\Assets;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ReturnAssetRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('assets.update') === true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'condition' => ['required', Rule::in(['new', 'good', 'fair', 'poor', 'damaged'])],
            'returned_at' => ['nullable', 'date'],
            'note' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
