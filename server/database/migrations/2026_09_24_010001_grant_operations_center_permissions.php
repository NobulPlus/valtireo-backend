<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    public function up(): void
    {
        $permissions = collect(['operations.view', 'operations.manage', 'operations.configure'])
            ->mapWithKeys(fn (string $name) => [$name => Permission::query()->firstOrCreate(['name' => $name, 'guard_name' => 'web'])]);

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $grants = [
            'organization_admin' => ['operations.view', 'operations.manage', 'operations.configure'],
            'hr_director' => ['operations.view', 'operations.manage', 'operations.configure'],
            'hr_officer' => ['operations.view', 'operations.manage'],
            'compliance_officer' => ['operations.view'], 'ict_admin' => ['operations.view'],
            'department_head' => ['operations.view'], 'supervisor' => ['operations.view'], 'employee' => ['operations.view'],
        ];

        foreach ($grants as $roleKey => $names) {
            Role::query()->where('key', $roleKey)->whereNotNull('organization_id')->each(function (Role $role) use ($names, $permissions): void {
                app(PermissionRegistrar::class)->setPermissionsTeamId($role->organization_id);
                $role->givePermissionTo(collect($names)->map(fn (string $name) => $permissions[$name]));
            });
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
};
