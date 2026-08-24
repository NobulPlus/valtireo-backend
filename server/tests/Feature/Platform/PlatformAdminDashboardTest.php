<?php

namespace Tests\Feature\Platform;

use App\Models\Organization;
use App\Models\PlatformModule;
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

        Sanctum::actingAs(User::query()->where('email', 'superadmin@valtireo.test')->firstOrFail());

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

        Sanctum::actingAs(User::query()->where('email', 'superadmin@valtireo.test')->firstOrFail());

        $this->getJson('/api/platform/organizations?search=Sterling%20Grove&status=active')
            ->assertOk()
            ->assertJsonPath('data.0.code', 'STERLINGGROVE')
            ->assertJsonPath('data.0.status', 'active')
            ->assertJsonPath('meta.total', 1);
    }

    public function test_super_admin_can_export_filtered_organizations(): void
    {
        $this->seed();

        Sanctum::actingAs(User::query()->where('email', 'superadmin@valtireo.test')->firstOrFail());

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

        Sanctum::actingAs(User::query()->where('email', 'superadmin@valtireo.test')->firstOrFail());

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

    public function test_super_admin_can_view_and_curate_the_permission_catalog(): void
    {
        $this->seed();

        $superAdmin = User::query()->where('email', 'superadmin@valtireo.test')->firstOrFail();
        Sanctum::actingAs($superAdmin);

        $catalog = $this->getJson('/api/permissions')->assertOk();
        $permission = $catalog->json('data.0');
        $this->assertNotEmpty($permission, 'Platform admin should see the permission catalog even without an org role.');

        $this->patchJson("/api/platform/permissions/{$permission['id']}", [
            'label' => 'Curated label',
            'description' => 'Curated description',
            'group' => 'Curated group',
        ])
            ->assertOk()
            ->assertJsonPath('permission.label', 'Curated label')
            ->assertJsonPath('permission.name', $permission['name']);

        $this->patchJson("/api/platform/permissions/{$permission['id']}", [
            'name' => 'employees.hacked',
        ])->assertOk();

        $this->assertDatabaseHas('permissions', [
            'id' => $permission['id'],
            'name' => $permission['name'],
        ]);
    }

    public function test_non_platform_admin_cannot_curate_the_permission_catalog(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        $permission = \App\Models\Permission::query()->firstOrFail();
        Sanctum::actingAs($admin);

        $this->patchJson("/api/platform/permissions/{$permission->id}", ['label' => 'Should not save'])
            ->assertForbidden();
    }

    public function test_super_admin_can_suspend_organization_and_cut_off_access(): void
    {
        $this->seed();

        $superAdmin = User::query()->where('email', 'superadmin@valtireo.test')->firstOrFail();
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
            ->assertJsonPath('organization.status', 'suspended')
            ->assertJsonPath('status_history.0.previous_status', 'active')
            ->assertJsonPath('status_history.0.new_status', 'suspended')
            ->assertJsonPath('status_history.0.reason', 'Subscription payment issue.')
            ->assertJsonPath('status_history.0.changed_by', 'Valtireo Super Admin');

        $this->assertSame('suspended', $organization->refresh()->status);
        $this->assertDatabaseCount('personal_access_tokens', 0);
        $this->assertDatabaseHas('organization_status_histories', [
            'organization_id' => $organization->id,
            'previous_status' => 'active',
            'new_status' => 'suspended',
            'reason' => 'Subscription payment issue.',
            'changed_by_id' => $superAdmin->id,
        ]);

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

        $superAdmin = User::query()->where('email', 'superadmin@valtireo.test')->firstOrFail();
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

        $superAdmin = User::query()->where('email', 'superadmin@valtireo.test')->firstOrFail();
        $platformOrganization = Organization::query()->where('code', 'VALTIREO')->firstOrFail();

        Sanctum::actingAs($superAdmin);

        $this->patchJson("/api/platform/organizations/{$platformOrganization->id}/status", [
            'status' => 'suspended',
        ])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'You cannot suspend or reactivate your own platform organization.');

        $this->assertSame('active', $platformOrganization->refresh()->status);
    }

    public function test_super_admin_can_enable_a_module_for_an_organization_with_a_duration(): void
    {
        $this->seed();

        $superAdmin = User::query()->where('email', 'superadmin@valtireo.test')->firstOrFail();
        $organization = Organization::query()->where('code', 'STERLINGGROVE')->firstOrFail();
        $module = PlatformModule::query()->where('key', 'assets')->firstOrFail();

        Sanctum::actingAs($superAdmin);

        $this->patchJson("/api/platform/organizations/{$organization->id}/modules/{$module->id}", [
            'status' => 'active',
            'duration' => 'one_year',
        ])
            ->assertOk()
            ->assertJsonPath('message', "{$module->name} enabled for {$organization->name}.");

        $subscription = $organization->moduleSubscriptions()->where('platform_module_id', $module->id)->firstOrFail();

        $this->assertSame('active', $subscription->status);
        $this->assertNotNull($subscription->expires_at);
        $this->assertTrue($subscription->expires_at->isSameDay(now()->addYear()));
    }

    public function test_super_admin_can_set_a_custom_expiry_when_enabling_a_module(): void
    {
        $this->seed();

        $superAdmin = User::query()->where('email', 'superadmin@valtireo.test')->firstOrFail();
        $organization = Organization::query()->where('code', 'STERLINGGROVE')->firstOrFail();
        $module = PlatformModule::query()->where('key', 'assets')->firstOrFail();
        $expiresAt = now()->addMonths(3)->toDateString();

        Sanctum::actingAs($superAdmin);

        $this->patchJson("/api/platform/organizations/{$organization->id}/modules/{$module->id}", [
            'status' => 'trial',
            'duration' => 'custom',
            'expires_at' => $expiresAt,
        ])->assertOk();

        $subscription = $organization->moduleSubscriptions()->where('platform_module_id', $module->id)->firstOrFail();

        $this->assertSame('trial', $subscription->status);
        $this->assertTrue($subscription->expires_at->isSameDay($expiresAt));
    }

    public function test_custom_module_duration_requires_an_expiry_date(): void
    {
        $this->seed();

        $superAdmin = User::query()->where('email', 'superadmin@valtireo.test')->firstOrFail();
        $organization = Organization::query()->where('code', 'STERLINGGROVE')->firstOrFail();
        $module = PlatformModule::query()->where('key', 'assets')->firstOrFail();

        Sanctum::actingAs($superAdmin);

        $this->patchJson("/api/platform/organizations/{$organization->id}/modules/{$module->id}", [
            'status' => 'active',
            'duration' => 'custom',
        ])->assertUnprocessable()->assertJsonValidationErrors(['expires_at']);
    }

    public function test_super_admin_can_disable_a_module_for_an_organization(): void
    {
        $this->seed();

        $superAdmin = User::query()->where('email', 'superadmin@valtireo.test')->firstOrFail();
        $organization = Organization::query()->where('code', 'STERLINGGROVE')->firstOrFail();
        $module = PlatformModule::query()->where('key', 'attendance')->firstOrFail();

        Sanctum::actingAs($superAdmin);

        $this->patchJson("/api/platform/organizations/{$organization->id}/modules/{$module->id}", [
            'status' => 'suspended',
        ])
            ->assertOk()
            ->assertJsonPath('message', "{$module->name} disabled for {$organization->name}.");

        $subscription = $organization->moduleSubscriptions()->where('platform_module_id', $module->id)->firstOrFail();

        $this->assertSame('suspended', $subscription->status);
    }

    public function test_non_super_admin_cannot_manage_organization_modules(): void
    {
        $this->seed();

        $employee = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $organization = Organization::query()->where('code', 'STERLINGGROVE')->firstOrFail();
        $module = PlatformModule::query()->where('key', 'assets')->firstOrFail();

        Sanctum::actingAs($employee);

        $this->patchJson("/api/platform/organizations/{$organization->id}/modules/{$module->id}", [
            'status' => 'active',
            'duration' => 'forever',
        ])->assertForbidden();
    }

    public function test_super_admin_can_edit_organization_workspace_identity_on_its_behalf(): void
    {
        $this->seed();

        $superAdmin = User::query()->where('email', 'superadmin@valtireo.test')->firstOrFail();
        $organization = Organization::query()->where('code', 'STERLINGGROVE')->firstOrFail();

        Sanctum::actingAs($superAdmin);

        $this->patchJson("/api/platform/organizations/{$organization->id}/workspace", [
            'name' => 'Sterling Grove MFB (Renamed)',
            'support_email' => 'help@sterlinggrovemfb.test',
            'timezone' => 'Africa/Accra',
        ])
            ->assertOk()
            ->assertJsonPath('message', 'Workspace identity updated for Sterling Grove MFB (Renamed).')
            ->assertJsonPath('organization.name', 'Sterling Grove MFB (Renamed)')
            ->assertJsonPath('workspace.identity.support_email', 'help@sterlinggrovemfb.test')
            ->assertJsonPath('workspace.localization.timezone', 'Africa/Accra');

        $organization->refresh();

        $this->assertSame('Sterling Grove MFB (Renamed)', $organization->name);
        $this->assertSame('help@sterlinggrovemfb.test', $organization->settings['identity']['support_email']);
        $this->assertSame('Africa/Accra', $organization->settings['localization']['timezone']);
    }

    public function test_organization_workspace_update_rejects_invalid_timezone(): void
    {
        $this->seed();

        $superAdmin = User::query()->where('email', 'superadmin@valtireo.test')->firstOrFail();
        $organization = Organization::query()->where('code', 'STERLINGGROVE')->firstOrFail();

        Sanctum::actingAs($superAdmin);

        $this->patchJson("/api/platform/organizations/{$organization->id}/workspace", [
            'timezone' => 'Not/A_Timezone',
        ])->assertUnprocessable()->assertJsonValidationErrors(['timezone']);
    }

    public function test_non_super_admin_cannot_edit_organization_workspace_identity(): void
    {
        $this->seed();

        $employee = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        $organization = Organization::query()->where('code', 'STERLINGGROVE')->firstOrFail();

        Sanctum::actingAs($employee);

        $this->patchJson("/api/platform/organizations/{$organization->id}/workspace", [
            'name' => 'Should not change',
        ])->assertForbidden();
    }

    public function test_super_admin_can_list_the_active_module_catalog(): void
    {
        $this->seed();

        $superAdmin = User::query()->where('email', 'superadmin@valtireo.test')->firstOrFail();
        $inactiveModule = PlatformModule::query()->where('key', 'assets')->firstOrFail();
        $inactiveModule->update(['is_active' => false]);

        Sanctum::actingAs($superAdmin);

        $response = $this->getJson('/api/platform/modules')
            ->assertOk()
            ->assertJsonStructure(['data' => [['id', 'key', 'name', 'description', 'category']]]);

        $keys = collect($response->json('data'))->pluck('key');

        $this->assertTrue($keys->contains('organization_setup'));
        $this->assertFalse($keys->contains('assets'));
    }

    public function test_non_super_admin_cannot_list_the_module_catalog(): void
    {
        $this->seed();

        $employee = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();

        Sanctum::actingAs($employee);

        $this->getJson('/api/platform/modules')->assertForbidden();
    }

    public function test_super_admin_can_provision_a_new_organization(): void
    {
        $this->seed();

        $superAdmin = User::query()->where('email', 'superadmin@valtireo.test')->firstOrFail();

        Sanctum::actingAs($superAdmin);

        $response = $this->postJson('/api/platform/organizations', [
            'organization' => [
                'name' => 'Zenith Freight Co',
                'code' => 'zenith-freight',
                'email' => 'ops@zenithfreight.test',
                'country' => 'Nigeria',
            ],
            'admin' => [
                'name' => 'Uche Nnamdi',
                'email' => 'uche.nnamdi@zenithfreight.test',
            ],
            'modules' => ['organization_setup', 'employees'],
        ])->assertCreated();

        $response->assertJsonPath('organization.code', 'ZENITH-FREIGHT');
        $response->assertJsonPath('organization.status', 'invited');
        $response->assertJsonPath('admin.email', 'uche.nnamdi@zenithfreight.test');
        $this->assertNotEmpty($response->json('invitation.temporary_password'));

        $this->assertDatabaseHas('organizations', ['code' => 'ZENITH-FREIGHT']);
        $this->assertDatabaseHas('users', ['email' => 'uche.nnamdi@zenithfreight.test']);

        $admin = User::query()->where('email', 'uche.nnamdi@zenithfreight.test')->firstOrFail();
        $this->assertTrue($admin->hasRole('Organization Admin'));
    }

    public function test_provisioning_rejects_a_duplicate_organization_code(): void
    {
        $this->seed();

        $superAdmin = User::query()->where('email', 'superadmin@valtireo.test')->firstOrFail();

        Sanctum::actingAs($superAdmin);

        $this->postJson('/api/platform/organizations', [
            'organization' => [
                'name' => 'Duplicate Co',
                'code' => 'STERLINGGROVE',
                'country' => 'Nigeria',
            ],
            'admin' => [
                'name' => 'Someone',
                'email' => 'someone@duplicateco.test',
            ],
            'modules' => ['organization_setup'],
        ])->assertUnprocessable()->assertJsonValidationErrors(['organization.code']);
    }

    public function test_non_super_admin_cannot_provision_an_organization(): void
    {
        $this->seed();

        $employee = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();

        Sanctum::actingAs($employee);

        $this->postJson('/api/platform/organizations', [
            'organization' => ['name' => 'Blocked Co', 'code' => 'BLOCKEDCO', 'country' => 'Nigeria'],
            'admin' => ['name' => 'Someone', 'email' => 'someone@blockedco.test'],
            'modules' => ['organization_setup'],
        ])->assertForbidden();
    }
}
