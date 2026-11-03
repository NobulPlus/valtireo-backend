<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\PermissionRegistrar;

/**
 * 'orbit.*' is also in RolePermissionSeeder's static permission list, so any
 * newly-created organization's Organization Admin role gets it automatically
 * (DefaultRoleSeedingService syncs permissions only when a role is freshly
 * created). This migration is the retroactive half, for organizations that
 * already exist — mirrors grant_operations_center_permissions.php, but
 * deliberately scoped to organization_admin alone: no other default role
 * gets blanket access to a newly-added module by convention in this app.
 */
return new class extends Migration
{
    public function up(): void
    {
        $names = ['orbit.access', 'orbit.workspaces.create', 'orbit.workspaces.administer', 'orbit.projects.create', 'orbit.reports.view_all', 'orbit.admin.manage'];

        $permissions = collect($names)
            ->mapWithKeys(fn (string $name) => [$name => Permission::query()->firstOrCreate(['name' => $name, 'guard_name' => 'web'])]);

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        Role::query()->where('key', 'organization_admin')->whereNotNull('organization_id')->each(function (Role $role) use ($permissions): void {
            app(PermissionRegistrar::class)->setPermissionsTeamId($role->organization_id);
            $role->givePermissionTo($permissions->values());
        });

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
};
