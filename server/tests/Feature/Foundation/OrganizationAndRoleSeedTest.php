<?php

namespace Tests\Feature\Foundation;

use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
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
        $this->assertTrue($admin->hasRole('Organization Admin'));

        $superAdmin = User::query()->where('email', 'superadmin@valtireo.test')->firstOrFail();
        $this->assertTrue($superAdmin->hasRole('Super Admin'));

        $this->assertDatabaseHas('roles', [
            'name' => 'HR Officer',
            'guard_name' => 'web',
        ]);

        $this->assertDatabaseHas('permissions', [
            'name' => 'employees.view',
            'guard_name' => 'web',
        ]);

        $this->assertTrue(Role::query()->where('name', 'Organization Admin')->exists());
        $this->assertTrue(Permission::query()->where('name', 'audit_logs.view')->exists());
    }
}
