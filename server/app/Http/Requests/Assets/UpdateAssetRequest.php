<?php

namespace App\Http\Requests\Assets;

use App\Models\Asset;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateAssetRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('assets.update') === true;
    }

    public function rules(): array
    {
        /** @var Asset|null $asset */
        $asset = $this->route('asset');

        return [
            'name' => ['sometimes', 'string', 'max:255'],
            'asset_tag' => [
                'sometimes',
                'string',
                'max:100',
                Rule::unique('assets', 'asset_tag')
                    ->where('organization_id', $this->user()?->organization_id)
                    ->ignore($asset?->id),
            ],
            'category' => ['sometimes', Rule::in(['laptop', 'phone', 'id_card', 'furniture', 'other'])],
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
