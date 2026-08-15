<?php

namespace Tests\Feature\Platform;

use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PlatformAdminDashboardTest extends TestCase
{
    use RefreshDatabase;

    public function test_super_admin_can_view_platform_dashboard(): void
    {
        $this->seed();

        Sanctum::actingAs(User::query()->where('email', 'admin@valtireo.test')->firstOrFail());

        $response = $this->getJson('/api/platform/dashboard')
            ->assertOk()
            ->assertJsonStructure([
                'summary' => [
                    'organizations_total',
                    'organizations_active',
                    'users_total',
                    'employees_total',
                    'pending_invitations',
                    'pending_documents',
                    'pending_leave_requests',
                ],
                'organizations_by_status',
                'module_adoption',
                'recent_organizations',
                'attention' => ['setup_incomplete', 'without_modules', 'without_admins'],
                'attention_details' => ['setup_incomplete', 'without_modules', 'without_admins'],
            ]);

        $this->assertGreaterThanOrEqual(7, $response->json('summary.organizations_total'));
        $this->assertNotEmpty($response->json('attention_details.setup_incomplete'));

        $organizationCodes = Organization::query()->pluck('code');
        $this->assertTrue($organizationCodes->contains('VALTIREO'));
        $this->assertTrue($organizationCodes->contains('STERLINGGROVE'));
        $this->assertFalse($organizationCodes->contains('LEADING'));
        $this->assertFalse($organizationCodes->contains('LASHMA'));
    }

    public function test_super_admin_can_list_and_filter_organizations(): void
    {
        $this->seed();

        Sanctum::actingAs(User::query()->where('email', 'admin@valtireo.test')->firstOrFail());

        $this->getJson('/api/platform/organizations?search=Sterling%20Grove&status=active')
            ->assertOk()
            ->assertJsonPath('data.0.code', 'STERLINGGROVE')
            ->assertJsonPath('data.0.status', 'active')
            ->assertJsonPath('meta.total', 1);
    }

    public function test_super_admin_can_export_filtered_organizations(): void
    {
        $this->seed();

        Sanctum::actingAs(User::query()->where('email', 'admin@valtireo.test')->firstOrFail());

        $response = $this->get('/api/platform/organizations/export?search=Sterling%20Grove&status=active&sort_by=name&sort_direction=asc')
            ->assertOk()
            ->assertDownload('valtireo-organizations-'.now()->format('Y-m-d').'.csv');

        $content = $response->streamedContent();

        $this->assertStringContainsString('Sterling Grove Microfinance Bank', $content);
        $this->assertStringContainsString('STERLINGGROVE', $content);
        $this->assertStringNotContainsString('Cedarcare', $content);
    }

    public function test_super_admin_can_view_selected_organization_detail(): void
    {
        $this->seed();

        $organization = Organization::query()->where('code', 'VALTIREO')->firstOrFail();

        Sanctum::actingAs(User::query()->where('email', 'admin@valtireo.test')->firstOrFail());

        $this->getJson("/api/platform/organizations/{$organization->id}")
            ->assertOk()
            ->assertJsonPath('organization.code', 'VALTIREO')
            ->assertJsonStructure([
                'organization',
                'workspace',
                'metrics' => ['users', 'employees', 'departments', 'locations'],
                'modules',
                'admins',
                'locations',
            ]);
    }

    public function test_non_super_admin_cannot_view_platform_console(): void
    {
        $this->seed();

        $employee = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        Sanctum::actingAs($employee);

        $this->getJson('/api/platform/dashboard')->assertForbidden();
        $this->getJson('/api/platform/organizations')->assertForbidden();
    }

    public function test_super_admin_can_suspend_organization_and_cut_off_access(): void
    {
        $this->seed();

        $superAdmin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $organization = Organization::query()->where('code', 'STERLINGGROVE')->firstOrFail();
        $organizationAdmin = User::query()->where('organization_id', $organization->id)->firstOrFail();
        $organizationAdmin->createToken('api')->plainTextToken;

        Sanctum::actingAs($superAdmin);

        $this->patchJson("/api/platform/organizations/{$organization->id}/status", [
            'status' => 'suspended',
            'reason' => 'Subscription payment issue.',
        ])
            ->assertOk()
            ->assertJsonPath('message', 'Organization suspended successfully.')
            ->assertJsonPath('organization.status', 'suspended');

        $this->assertSame('suspended', $organization->refresh()->status);
        $this->assertDatabaseCount('personal_access_tokens', 0);

        Sanctum::actingAs($organizationAdmin);

        $this->getJson('/api/auth/me')->assertForbidden();

        $this->postJson('/api/auth/login', [
            'email' => $organizationAdmin->email,
            'password' => 'Password1!',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);
    }

    public function test_super_admin_can_reactivate_suspended_organization(): void
    {
        $this->seed();

        $superAdmin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $organization = Organization::query()->where('code', 'BLUEBRIDGE')->firstOrFail();
        $organizationAdmin = User::query()->where('organization_id', $organization->id)->firstOrFail();

        Sanctum::actingAs($superAdmin);

        $this->patchJson("/api/platform/organizations/{$organization->id}/status", [
            'status' => 'active',
        ])
            ->assertOk()
            ->assertJsonPath('message', 'Organization reactivated successfully.')
            ->assertJsonPath('organization.status', 'active');

        $this->postJson('/api/auth/login', [
            'email' => $organizationAdmin->email,
            'password' => 'Password1!',
        ])->assertOk();
    }

    public function test_super_admin_cannot_suspend_own_platform_organization(): void
    {
        $this->seed();

        $superAdmin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $platformOrganization = Organization::query()->where('code', 'VALTIREO')->firstOrFail();

        Sanctum::actingAs($superAdmin);

        $this->patchJson("/api/platform/organizations/{$platformOrganization->id}/status", [
            'status' => 'suspended',
        ])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'You cannot suspend or reactivate your own platform organization.');

        $this->assertSame('active', $platformOrganization->refresh()->status);
    }
}
