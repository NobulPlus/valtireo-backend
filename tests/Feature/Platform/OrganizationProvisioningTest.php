<?php

namespace Tests\Feature\Platform;

use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OrganizationProvisioningTest extends TestCase
{
    use RefreshDatabase;

    public function test_super_admin_can_provision_customer_organization(): void
    {
        $this->seed();

        $superAdmin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        Sanctum::actingAs($superAdmin);

        $response = $this->postJson('/api/platform/organizations', [
            'organization' => [
                'name' => 'Leading Digitals',
                'code' => 'leading',
                'email' => 'hello@leadingdigitals.test',
                'phone' => '+2348012345678',
                'website' => 'https://leadingdigitals.test',
                'sector' => 'technology',
                'country' => 'Nigeria',
                'state' => 'Lagos',
                'city' => 'Ikeja',
                'address' => '12 Allen Avenue',
            ],
            'admin' => [
                'name' => 'Paul Adeleye',
                'email' => 'paul@leadingdigitals.test',
            ],
            'modules' => [
                'organization_setup',
                'users_roles',
                'organization_structure',
                'employees',
                'leave',
            ],
            'workspace' => [
                'identity' => [
                    'welcome_message' => 'Welcome to Leading Digitals.',
                    'support_email' => 'people@leadingdigitals.test',
                ],
                'theme' => [
                    'primary_color' => '#0F766E',
                    'accent_color' => '#F59E0B',
                    'font_family' => 'Montserrat',
                ],
            ],
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('organization.code', 'LEADING')
            ->assertJsonPath('organization.status', 'invited')
            ->assertJsonPath('main_location.code', 'MAIN')
            ->assertJsonPath('admin.email', 'paul@leadingdigitals.test')
            ->assertJsonPath('workspace.theme.primary_color', '#0F766E')
            ->assertJsonPath('workspace.identity.welcome_message', 'Welcome to Leading Digitals.')
            ->assertJsonPath('invitation.delivery_status', 'pending_mail_provider')
            ->assertJsonStructure([
                'organization',
                'main_location',
                'admin',
                'modules',
                'workspace',
                'invitation' => ['email', 'temporary_password', 'login_hint', 'delivery_status'],
                'created_by',
            ]);

        $organization = Organization::query()->where('code', 'LEADING')->firstOrFail();
        $admin = User::query()->where('email', 'paul@leadingdigitals.test')->firstOrFail();

        $this->assertSame($organization->id, $admin->organization_id);
        $this->assertTrue($admin->hasRole('Organization Admin'));
        $this->assertSame(5, $organization->moduleSubscriptions()->count());
        $this->assertDatabaseHas('organization_locations', [
            'organization_id' => $organization->id,
            'code' => 'MAIN',
            'is_primary' => true,
        ]);
    }

    public function test_provisioned_admin_can_login_with_temporary_password(): void
    {
        $this->seed();

        $superAdmin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();
        Sanctum::actingAs($superAdmin);

        $temporaryPassword = $this->postJson('/api/platform/organizations', [
            'organization' => [
                'name' => 'Northstar Labs',
                'code' => 'NORTHSTAR',
                'country' => 'Nigeria',
            ],
            'admin' => [
                'name' => 'Nora Stone',
                'email' => 'nora@northstar.test',
            ],
            'modules' => ['organization_setup', 'employees'],
        ])
            ->assertCreated()
            ->json('invitation.temporary_password');

        $this->postJson('/api/auth/login', [
            'email' => 'nora@northstar.test',
            'password' => $temporaryPassword,
        ])
            ->assertOk()
            ->assertJsonPath('user.email', 'nora@northstar.test')
            ->assertJsonPath('organization.code', 'NORTHSTAR')
            ->assertJsonPath('workspace.workspace_code', 'NORTHSTAR');
    }

    public function test_non_super_admin_cannot_provision_organization(): void
    {
        $this->seed();

        $employee = User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail();
        Sanctum::actingAs($employee);

        $this->postJson('/api/platform/organizations', [
            'organization' => [
                'name' => 'Blocked Company',
                'code' => 'BLOCKED',
                'country' => 'Nigeria',
            ],
            'admin' => [
                'name' => 'Blocked Admin',
                'email' => 'blocked@example.test',
            ],
            'modules' => ['employees'],
        ])
            ->assertForbidden();
    }
}
