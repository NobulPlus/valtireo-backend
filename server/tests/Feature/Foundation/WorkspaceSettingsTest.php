<?php

namespace Tests\Feature\Foundation;

use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class WorkspaceSettingsTest extends TestCase
{
    use RefreshDatabase;

    public function test_session_bootstrap_includes_workspace_settings(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        Sanctum::actingAs($admin);

        $this->getJson('/api/auth/me')
            ->assertOk()
            ->assertJsonPath('workspace.workspace_code', 'VALTIREO')
            ->assertJsonPath('workspace.theme.primary_color', '#155EEF')
            ->assertJsonPath('workspace.localization.timezone', 'Africa/Lagos')
            ->assertJsonStructure([
                'workspace' => [
                    'identity',
                    'theme',
                    'localization',
                    'employee_experience',
                ],
            ]);
    }

    public function test_user_can_view_their_workspace_settings(): void
    {
        $this->seed();

        $employee = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        Sanctum::actingAs($employee);

        $this->getJson('/api/workspace')
            ->assertOk()
            ->assertJsonPath('workspace.workspace_code', 'VALTIREO')
            ->assertJsonPath('workspace.theme.font_family', 'Inter');
    }

    public function test_admin_can_update_workspace_theme_and_employee_experience(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        Sanctum::actingAs($admin);

        $this->patchJson('/api/workspace/settings', [
            'identity' => [
                'welcome_message' => 'Welcome to Leading Digitals.',
                'support_email' => 'people@leadingdigitals.test',
            ],
            'theme' => [
                'mode' => 'system',
                'primary_color' => '#0F766E',
                'accent_color' => '#F59E0B',
                'font_family' => 'Montserrat',
                'radius' => 'rounded',
                'density' => 'compact',
            ],
            'employee_experience' => [
                'show_org_chart' => false,
                'dashboard_widgets' => ['profile_completion', 'pending_actions'],
                'required_profile_fields' => ['personal_email', 'residential_address'],
            ],
        ])
            ->assertOk()
            ->assertJsonPath('workspace.identity.welcome_message', 'Welcome to Leading Digitals.')
            ->assertJsonPath('workspace.theme.primary_color', '#0F766E')
            ->assertJsonPath('workspace.theme.font_family', 'Montserrat')
            ->assertJsonPath('workspace.employee_experience.show_org_chart', false)
            ->assertJsonPath('workspace.employee_experience.required_profile_fields.0', 'personal_email');

        $organization = Organization::query()->where('code', 'VALTIREO')->firstOrFail();

        $this->assertSame('#0F766E', $organization->settings['theme']['primary_color']);
    }

    public function test_employee_cannot_update_workspace_settings(): void
    {
        $this->seed();

        $employee = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        Sanctum::actingAs($employee);

        $this->patchJson('/api/workspace/settings', [
            'theme' => [
                'primary_color' => '#0F766E',
            ],
        ])
            ->assertForbidden();
    }

    public function test_workspace_settings_validation_rejects_invalid_theme_values(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        Sanctum::actingAs($admin);

        $this->patchJson('/api/workspace/settings', [
            'theme' => [
                'mode' => 'neon',
                'primary_color' => 'blue',
                'font_family' => 'Comic Sans',
            ],
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors([
                'theme.mode',
                'theme.primary_color',
                'theme.font_family',
            ]);
    }

    public function test_admin_can_upload_and_remove_workspace_logo(): void
    {
        Storage::fake('public');
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $organization = Organization::query()->where('code', 'VALTIREO')->firstOrFail();
        Sanctum::actingAs($admin);

        $response = $this->post('/api/workspace/identity/logo', [
            'logo' => UploadedFile::fake()->image('logo.png', 200, 200),
        ], ['Accept' => 'application/json'])
            ->assertOk();

        $logoUrl = $response->json('workspace.identity.logo_url');
        $this->assertNotNull($logoUrl);
        $this->assertStringContainsString('/storage/organizations/'.$organization->id.'/branding/', $logoUrl);

        $path = "organizations/{$organization->id}/branding/".basename(parse_url($logoUrl, PHP_URL_PATH));
        Storage::disk('public')->assertExists($path);

        $this->deleteJson('/api/workspace/identity/logo')
            ->assertOk()
            ->assertJsonPath('workspace.identity.logo_url', null);

        Storage::disk('public')->assertMissing($path);
    }

    public function test_workspace_logo_upload_rejects_non_image_files(): void
    {
        Storage::fake('public');
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        Sanctum::actingAs($admin);

        $this->post('/api/workspace/identity/logo', [
            'logo' => UploadedFile::fake()->create('logo.svg', 10, 'image/svg+xml'),
        ], ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['logo']);
    }

    public function test_employee_cannot_upload_workspace_logo(): void
    {
        Storage::fake('public');
        $this->seed();

        $employee = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        Sanctum::actingAs($employee);

        $this->post('/api/workspace/identity/logo', [
            'logo' => UploadedFile::fake()->image('logo.png'),
        ], ['Accept' => 'application/json'])
            ->assertForbidden();
    }
}
