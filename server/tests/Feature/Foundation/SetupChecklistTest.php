<?php

namespace Tests\Feature\Foundation;

use App\Models\Organization;
use App\Models\User;
use App\Services\DefaultRoleSeedingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SetupChecklistTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_view_guided_setup_checklist(): void
    {
        $this->seed();

        Sanctum::actingAs(User::query()->where('email', 'admin@valtireo.test')->firstOrFail());

        $this->getJson('/api/setup/checklist')
            ->assertOk()
            ->assertJsonPath('status', 'ready')
            ->assertJsonPath('summary.required_percentage', 100)
            ->assertJsonFragment(['key' => 'organization_profile'])
            ->assertJsonFragment(['key' => 'document_requirements'])
            ->assertJsonFragment(['key' => 'leave_types'])
            ->assertJsonFragment(['key' => 'attendance_settings']);
    }

    public function test_checklist_shows_missing_required_actions_for_new_organization(): void
    {
        $this->seed();

        $organization = Organization::query()->create([
            'name' => 'Northstar Limited',
            'code' => 'NORTHSTAR',
            'status' => 'setup',
            'country' => 'Nigeria',
            'settings' => [],
        ]);

        $admin = User::query()->create([
            'organization_id' => $organization->id,
            'name' => 'Northstar Admin',
            'email' => 'admin@northstar.test',
            'password' => 'Password1!',
        ]);

        // Roles are organization-owned — this org was created directly
        // (bypassing OrganizationProvisioningService, which normally does
        // this), so it has no roles of its own yet without seeding them here.
        $this->setPermissionsTeamId($organization->id);
        $roles = app(DefaultRoleSeedingService::class)->seedForOrganization($organization);
        $admin->assignRole($roles->get('organization_admin'));

        Sanctum::actingAs($admin);

        $this->getJson('/api/setup/checklist')
            ->assertOk()
            ->assertJsonPath('status', 'in_progress')
            ->assertJsonPath('summary.required_percentage', fn (int $percentage) => $percentage < 100)
            ->assertJsonFragment([
                'key' => 'locations',
                'completed' => false,
                'required' => true,
            ])
            ->assertJsonFragment([
                'key' => 'employees',
                'completed' => false,
                'required' => true,
            ]);
    }

    public function test_employee_cannot_view_setup_checklist(): void
    {
        $this->seed();

        Sanctum::actingAs(User::query()->where('email', 'aisha.bello@valtireo.test')->firstOrFail());

        $this->getJson('/api/setup/checklist')
            ->assertForbidden();
    }
}
