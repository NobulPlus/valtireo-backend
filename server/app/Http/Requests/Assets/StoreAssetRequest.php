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
            'serial_number' => ['nullable', 'string', 'max:100'],
            'asset_category_id' => [
                'required',
                'integer',
                Rule::exists('asset_categories', 'id')->where('organization_id', $this->user()?->organization_id),
            ],
            'status' => ['sometimes', Rule::in(['available', 'assigned', 'maintenance', 'retired'])],
            'condition' => ['sometimes', Rule::in(['new', 'good', 'fair', 'poor', 'damaged'])],
            'assigned_to_employee_id' => [
                'nullable',
                'integer',
                Rule::exists('employees', 'id')->where('organization_id', $this->user()?->organization_id),
            ],
            'organization_location_id' => [
                'nullable',
                'integer',
                Rule::exists('organization_locations', 'id')->where('organization_id', $this->user()?->organization_id),
            ],
            'purchase_date' => ['nullable', 'date'],
            'warranty_expires_at' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
