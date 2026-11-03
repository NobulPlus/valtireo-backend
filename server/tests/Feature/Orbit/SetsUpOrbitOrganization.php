<?php

namespace Tests\Feature\Orbit;

use App\Models\Organization;
use App\Models\OrganizationModule;
use App\Models\PlatformModule;
use App\Models\User;
use App\Services\DefaultRoleSeedingService;
use Database\Seeders\RolePermissionSeeder;

/**
 * Lightweight, controlled Orbit test fixture — deliberately not the full
 * $this->seed() demo chain (slower, and the demo org isn't subscribed to
 * Orbit anyway, by design: a module in the catalog never auto-subscribes
 * any organization). Seeds only the global permission catalog, then builds
 * one organization with an Organization Admin (who gets orbit.* for free,
 * since the role is freshly created — see RolePermissionSeeder) and a plain
 * Employee, and explicitly subscribes that organization to Orbit.
 */
trait SetsUpOrbitOrganization
{
    /**
     * @return array{organization: Organization, admin: User, employee: User, roles: \Illuminate\Support\Collection<string, \App\Models\Role>}
     */
    protected function createOrbitOrganization(string $code = 'ORBITCO'): array
    {
        $this->seed(RolePermissionSeeder::class);

        $organization = Organization::create([
            'name' => "{$code} Limited",
            'code' => $code,
            'status' => 'active',
            'country' => 'Nigeria',
            'settings' => [],
        ]);

        $this->setPermissionsTeamId($organization->id);
        $roles = app(DefaultRoleSeedingService::class)->seedForOrganization($organization);

        $admin = User::create([
            'organization_id' => $organization->id,
            'name' => "{$code} Admin",
            'email' => strtolower($code).'-admin@test.local',
            'password' => 'Password1!',
        ]);
        $admin->syncRoles([$roles->get('organization_admin')]);

        $employee = User::create([
            'organization_id' => $organization->id,
            'name' => "{$code} Employee",
            'email' => strtolower($code).'-employee@test.local',
            'password' => 'Password1!',
        ]);
        $employee->syncRoles([$roles->get('employee')]);

        $module = PlatformModule::query()->where('key', 'orbit')->firstOrFail();
        OrganizationModule::create([
            'organization_id' => $organization->id,
            'platform_module_id' => $module->id,
            'status' => 'active',
        ]);

        return ['organization' => $organization, 'admin' => $admin, 'employee' => $employee, 'roles' => $roles];
    }
}
