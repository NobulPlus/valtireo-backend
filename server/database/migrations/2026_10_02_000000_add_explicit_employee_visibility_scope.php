<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    public function up(): void
    {
        $registrar = app(PermissionRegistrar::class);
        $previousTeam = $registrar->getPermissionsTeamId();
        $permission = Permission::query()->firstOrCreate(['name' => 'employees.view_all', 'guard_name' => 'web']);

        try {
            // Preserve organization-wide access for the existing HR/compliance
            // starter roles only when they still hold employee-view permission.
            // Custom roles require an explicit scope review before deployment.
            Role::query()->whereIn('key', ['organization_admin', 'hr_director', 'hr_officer', 'compliance_officer'])
                ->whereNotNull('organization_id')->each(function (Role $role) use ($permission, $registrar): void {
                    $registrar->setPermissionsTeamId($role->organization_id);
                    if ($role->hasPermissionTo('employees.view')) {
                        $role->givePermissionTo($permission);
                    }
                });
        } finally {
            $registrar->setPermissionsTeamId($previousTeam);
            $registrar->forgetCachedPermissions();
        }
    }

    public function down(): void
    {
        Permission::query()->where('name', 'employees.view_all')->where('guard_name', 'web')->delete();
        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
};
