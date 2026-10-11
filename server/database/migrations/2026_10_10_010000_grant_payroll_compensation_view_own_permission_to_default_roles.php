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
            'name' => 'payroll.compensation.view_own',
            'guard_name' => 'web',
        ]);

        // Backfill: any role that already holds payroll.payslips.view_own
        // (today, only the seeded Employee role) also gets the ability to
        // view — read-only — its own compensation, bank accounts, and
        // statutory profile, so already-provisioned organizations get the
        // same self-service capability as newly-provisioned ones.
        Role::query()
            ->whereHas('permissions', fn ($query) => $query->where('name', 'payroll.payslips.view_own'))
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
