<?php

namespace Tests\Feature\Foundation;

use App\Models\Organization;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OrganizationAndRoleSeedTest extends TestCase
{
    use RefreshDatabase;

    public function test_database_seeder_creates_foundation_organization_and_roles(): void
    {
        $this->seed();

        $organization = Organization::query()->where('code', 'VALTIREO')->firstOrFail();
        $admin = User::query()->where('email', 'admin@valtireo.test')->firstOrFail();

        $this->assertSame('Valtireo Demo Organization', $organization->name);
        $this->assertTrue($organization->locations()->where('code', 'HQ')->exists());

        $this->assertSame($organization->id, $admin->organization_id);

        $this->setPermissionsTeamId($organization->id);
        $this->assertTrue($admin->hasRole('Organization Admin'));

        // Platform authority is a plain boolean now, independent of any
        // Spatie role — the global "Super Admin" role is retired.
        $superAdmin = User::query()->where('email', 'superadmin@valtireo.test')->firstOrFail();
        $this->assertTrue($superAdmin->is_platform_admin);

        $this->assertDatabaseHas('roles', [
            'organization_id' => $organization->id,
            'name' => 'HR Officer',
            'guard_name' => 'web',
        ]);

        $this->assertDatabaseHas('permissions', [
            'name' => 'employees.view',
            'guard_name' => 'web',
        ]);

        $this->assertTrue(Role::query()->where('organization_id', $organization->id)->where('name', 'Organization Admin')->exists());
        $this->assertTrue(Permission::query()->where('name', 'audit_logs.view')->exists());
    }
}
