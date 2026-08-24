<?php

namespace App\Services;

use App\Models\Organization;

class WorkspaceSettingsService
{
    /**
     * @return array<string, mixed>
     */
    public function forOrganization(Organization $organization): array
    {
        return [
            'organization_id' => $organization->id,
            'workspace_name' => $organization->name,
            'workspace_code' => $organization->code,
            ...$this->settings($organization),
        ];
    }

    /**
     * @param array<string, mixed> $settings
     *
     * @return array<string, mixed>
     */
    public function update(Organization $organization, array $settings): array
    {
        $name = $settings['name'] ?? null;
        unset($settings['name']);

        $organization->update([
            ...($name !== null ? ['name' => $name] : []),
            'settings' => array_replace_recursive($this->settings($organization), $settings),
        ]);

        return $this->forOrganization($organization->refresh());
    }

    /**
     * @return array<string, mixed>
     */
    private function settings(Organization $organization): array
    {
        return array_replace_recursive($this->defaults(), $organization->settings ?? []);
    }

    /**
     * @return array<string, mixed>
     */
    private function defaults(): array
    {
        return [
            'identity' => [
                'logo_url' => null,
                'favicon_url' => null,
                'login_background_url' => null,
                'short_name' => null,
                'welcome_message' => 'Welcome to your Valtireo workspace.',
                'support_email' => null,
            ],
            'theme' => [
                'mode' => 'light',
                'primary_color' => '#155EEF',
                'accent_color' => '#12B76A',
                'sidebar_color' => '#101828',
                'button_color' => '#155EEF',
                'font_family' => 'Inter',
                'radius' => 'soft',
                'density' => 'comfortable',
            ],
            'localization' => [
                'timezone' => 'Africa/Lagos',
                'date_format' => 'd/m/Y',
                'time_format' => '24h',
                'currency' => 'NGN',
                'country' => 'Nigeria',
            ],
            'employee_experience' => [
                'show_org_chart' => true,
                'allow_profile_corrections' => true,
                'allow_employee_directory' => true,
                'dashboard_widgets' => [
                    'profile_completion',
                    'pending_actions',
                    'modules',
                    'manager',
                ],
                'required_profile_fields' => [
                    'date_of_birth',
                    'gender',
                    'personal_email',
                    'residential_address',
                    'next_of_kin_name',
                    'next_of_kin_phone',
                    'emergency_contact_name',
                    'emergency_contact_phone',
                ],
                'onboarding_checklist' => [
                    'accept_invitation',
                    'set_password',
                    'complete_profile',
                    'submit_required_documents',
                    'await_hr_approval',
                ],
            ],
        ];
    }
}
