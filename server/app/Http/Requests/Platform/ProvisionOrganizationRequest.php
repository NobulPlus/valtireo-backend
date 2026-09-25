<?php

namespace App\Http\Requests\Platform;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ProvisionOrganizationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->is_platform_admin === true;
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('organization.code')) {
            $this->merge([
                'organization' => [
                    ...$this->input('organization', []),
                    'code' => strtoupper((string) $this->input('organization.code')),
                ],
            ]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'organization' => ['required', 'array'],
            'organization.name' => ['required', 'string', 'max:255'],
            'organization.code' => ['required', 'alpha_dash', 'max:30', Rule::unique('organizations', 'code')],
            'organization.email' => ['nullable', 'email', 'max:255'],
            'organization.phone' => ['nullable', 'string', 'max:50'],
            'organization.website' => ['nullable', 'url', 'max:255'],
            'organization.sector' => ['nullable', 'string', 'max:100'],
            'organization.country' => ['required', 'string', 'max:100'],
            'organization.state' => ['nullable', 'string', 'max:100'],
            'organization.city' => ['nullable', 'string', 'max:100'],
            'organization.address' => ['nullable', 'string', 'max:500'],

            'admin' => ['required', 'array'],
            'admin.name' => ['required', 'string', 'max:255'],
            'admin.email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')],

            'modules' => ['required', 'array', 'min:1'],
            'modules.*' => ['required', 'string', Rule::exists('platform_modules', 'key')->where('is_active', true)],

            'workspace' => ['sometimes', 'array'],
            'workspace.identity' => ['sometimes', 'array'],
            'workspace.identity.logo_url' => ['nullable', 'url', 'max:2048'],
            'workspace.identity.favicon_url' => ['nullable', 'url', 'max:2048'],
            'workspace.identity.login_background_url' => ['nullable', 'url', 'max:2048'],
            'workspace.identity.welcome_message' => ['nullable', 'string', 'max:180'],
            'workspace.identity.support_email' => ['nullable', 'email', 'max:255'],

            'workspace.theme' => ['sometimes', 'array'],
            'workspace.theme.mode' => ['sometimes', Rule::in(['light', 'dark', 'system'])],
            'workspace.theme.primary_color' => ['sometimes', 'hex_color'],
            'workspace.theme.accent_color' => ['sometimes', 'hex_color'],
            'workspace.theme.sidebar_color' => ['sometimes', 'hex_color'],
            'workspace.theme.button_color' => ['sometimes', 'hex_color'],
            'workspace.theme.font_family' => ['sometimes', Rule::in(['Inter', 'Roboto', 'Lato', 'Montserrat', 'Open Sans', 'Source Sans 3'])],
            'workspace.theme.radius' => ['sometimes', Rule::in(['sharp', 'soft', 'rounded'])],
            'workspace.theme.density' => ['sometimes', Rule::in(['compact', 'comfortable', 'spacious'])],

            'workspace.localization' => ['sometimes', 'array'],
            'workspace.localization.timezone' => ['sometimes', 'timezone'],
            'workspace.localization.date_format' => ['sometimes', Rule::in(['d/m/Y', 'm/d/Y', 'Y-m-d', 'd M Y'])],
            'workspace.localization.time_format' => ['sometimes', Rule::in(['12h', '24h'])],
            'workspace.localization.currency' => ['sometimes', 'string', 'size:3'],
            'workspace.localization.country' => ['sometimes', 'string', 'max:100'],
        ];
    }
}
