<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    public function up(): void
    {
        $grants = [
            'organization_admin' => [
                'payroll.view', 'payroll.settings.view', 'payroll.settings.update',
                'payroll.compensation.view', 'payroll.compensation.manage', 'payroll.bank_accounts.manage',
                'payroll.runs.view', 'payroll.runs.manage', 'payroll.runs.submit', 'payroll.runs.approve',
                'payroll.runs.finalize', 'payroll.payslips.view_own', 'payroll.reports.view',
            ],
            'hr_director' => [
                'payroll.view', 'payroll.settings.view', 'payroll.compensation.view',
                'payroll.runs.view', 'payroll.reports.view', 'payroll.payslips.view_own',
            ],
            'hr_officer' => [
                'payroll.view', 'payroll.compensation.view', 'payroll.runs.view', 'payroll.payslips.view_own',
            ],
            'employee' => ['payroll.payslips.view_own'],
        ];

        foreach (collect($grants)->flatten()->unique() as $name) {
            Permission::query()->firstOrCreate(['name' => $name, 'guard_name' => 'web']);
        }

        foreach ($grants as $roleKey => $permissions) {
            Role::query()->where('key', $roleKey)->whereNotNull('organization_id')->each(
                function (Role $role) use ($permissions): void {
                    app(PermissionRegistrar::class)->setPermissionsTeamId($role->organization_id);
                    $role->givePermissionTo($permissions);
                }
            );
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
};
