<?php

namespace App\Http\Requests\Assets;

use App\Models\AssetCategory;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateAssetCategoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('assets.update') === true;
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('code')) {
            $this->merge(['code' => strtoupper((string) $this->input('code'))]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        /** @var AssetCategory|null $assetCategory */
        $assetCategory = $this->route('assetCategory');

        return [
            'name' => ['sometimes', 'string', 'max:255'],
            'code' => [
                'sometimes',
                'alpha_dash',
                'max:50',
                Rule::unique('asset_categories', 'code')
                    ->where('organization_id', $this->user()?->organization_id)
                    ->ignore($assetCategory?->id),
            ],
            'description' => ['nullable', 'string', 'max:1000'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
