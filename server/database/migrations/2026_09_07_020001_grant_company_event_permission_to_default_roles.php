<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    public function up(): void
    {
        $permission = Permission::query()->firstOrCreate([
            'name' => 'company_events.manage',
            'guard_name' => 'web',
        ]);

        Role::query()
            ->whereIn('key', ['organization_admin', 'hr_director'])
            ->whereNotNull('organization_id')
            ->each(function (Role $role) use ($permission): void {
                app(PermissionRegistrar::class)->setPermissionsTeamId($role->organization_id);
                $role->givePermissionTo($permission);
            });

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
};
