<?php

namespace App\Http\Requests\Assets;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreAssetRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('assets.create') === true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'asset_tag' => [
                'required',
                'string',
                'max:100',
                Rule::unique('assets', 'asset_tag')->where('organization_id', $this->user()?->organization_id),
            ],
            'category' => ['required', Rule::in(['laptop', 'phone', 'id_card', 'furniture', 'other'])],
            'status' => ['sometimes', Rule::in(['available', 'assigned', 'maintenance', 'retired'])],
            'assigned_to_employee_id' => [
                'nullable',
                'integer',
                Rule::exists('employees', 'id')->where('organization_id', $this->user()?->organization_id),
            ],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
