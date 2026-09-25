<?php

namespace App\Http\Requests\Workspace;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateWorkspaceSettingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('workspace_settings.update') === true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'string', 'max:255'],

            'identity' => ['sometimes', 'array'],
            'identity.logo_url' => ['nullable', 'url', 'max:2048'],
            'identity.favicon_url' => ['nullable', 'url', 'max:2048'],
            'identity.login_background_url' => ['nullable', 'url', 'max:2048'],
            'identity.short_name' => ['nullable', 'string', 'max:40'],
            'identity.welcome_message' => ['nullable', 'string', 'max:180'],
            'identity.support_email' => ['nullable', 'email', 'max:255'],

            'theme' => ['sometimes', 'array'],
            'theme.mode' => ['sometimes', Rule::in(['light', 'dark', 'system'])],
            'theme.primary_color' => ['sometimes', 'hex_color'],
            'theme.accent_color' => ['sometimes', 'hex_color'],
            'theme.sidebar_color' => ['sometimes', 'hex_color'],
            'theme.button_color' => ['sometimes', 'hex_color'],
            'theme.font_family' => ['sometimes', Rule::in(['Inter', 'Roboto', 'Lato', 'Montserrat', 'Open Sans', 'Source Sans 3'])],
            'theme.radius' => ['sometimes', Rule::in(['sharp', 'soft', 'rounded'])],
            'theme.density' => ['sometimes', Rule::in(['compact', 'comfortable', 'spacious'])],

            'localization' => ['sometimes', 'array'],
            'localization.timezone' => ['sometimes', 'timezone'],
            'localization.date_format' => ['sometimes', Rule::in(['d/m/Y', 'm/d/Y', 'Y-m-d', 'd M Y'])],
            'localization.time_format' => ['sometimes', Rule::in(['12h', '24h'])],
            'localization.currency' => ['sometimes', 'string', 'size:3'],
            'localization.country' => ['sometimes', 'string', 'max:100'],

            'employee_experience' => ['sometimes', 'array'],
            'employee_experience.show_org_chart' => ['sometimes', 'boolean'],
            'employee_experience.allow_profile_corrections' => ['sometimes', 'boolean'],
            'employee_experience.allow_employee_directory' => ['sometimes', 'boolean'],
            'employee_experience.dashboard_widgets' => ['sometimes', 'array'],
            'employee_experience.dashboard_widgets.*' => ['string', 'max:80'],
            'employee_experience.required_profile_fields' => ['sometimes', 'array'],
            'employee_experience.required_profile_fields.*' => ['string', 'max:80'],
            'employee_experience.onboarding_checklist' => ['sometimes', 'array'],
            'employee_experience.onboarding_checklist.*' => ['string', 'max:80'],
        ];
    }
}
