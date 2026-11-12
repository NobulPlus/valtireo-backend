<?php

use App\Models\Permission;
use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\PermissionRegistrar;

/**
 * 'orbit.reports.view_all' and 'orbit.admin.manage' were granted by
 * 2026_11_01_000001_grant_orbit_permissions.php but never checked anywhere
 * in app/ — Orbit has no cross-workspace reporting screen and no org-level
 * admin screen yet. Removing the dangling permissions (rather than leaving
 * them seeded-but-meaningless) until those screens actually exist; cascading
 * FKs on role_has_permissions/model_has_permissions clear the grants too.
 */
return new class extends Migration
{
    public function up(): void
    {
        Permission::query()
            ->whereIn('name', ['orbit.reports.view_all', 'orbit.admin.manage'])
            ->delete();

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
};
