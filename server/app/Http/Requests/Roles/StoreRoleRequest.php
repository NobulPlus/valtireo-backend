<?php

namespace App\Http\Requests\Roles;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreRoleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('roles.create') === true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('roles', 'name')
                    ->where(fn ($query) => $query
                        ->where('organization_id', $this->user()->organization_id)
                        ->where('guard_name', 'web')),
            ],
            'description' => ['nullable', 'string', 'max:2000'],
            'permission_names' => ['sometimes', 'array'],
            'permission_names.*' => ['string', 'distinct', Rule::exists('permissions', 'name')],
        ];
    }
}
