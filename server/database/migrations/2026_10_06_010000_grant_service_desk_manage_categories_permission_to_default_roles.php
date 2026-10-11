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
            'name' => 'service_desk.manage_categories',
            'guard_name' => 'web',
        ]);

        // Ticket categories used to be gated on service_desk.view (a queue
        // read permission). Every role that already holds it keeps the
        // ability to manage categories under the new, narrower permission —
        // this backfills already-provisioned organizations so nothing that
        // currently works stops working.
        Role::query()
            ->whereHas('permissions', fn ($query) => $query->where('name', 'service_desk.view'))
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
