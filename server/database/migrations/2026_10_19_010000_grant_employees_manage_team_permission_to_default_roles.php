<?php

use App\Models\Permission;
use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    public function up(): void
    {
        // Register only: a standard key does not imply consent to expand an
        // existing organization's customized access. New roles receive defaults
        // through DefaultRoleSeedingService. Existing grants require an explicit,
        // reviewed organization role edit through the existing audited workflow.
        Permission::query()->firstOrCreate([
            'name' => 'employees.manage_team',
            'guard_name' => 'web',
        ]);
        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        // Never remove a permission that an organization may now have granted.
        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
};
