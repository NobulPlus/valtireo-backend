<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Enables Spatie's "teams" feature on top of the already-migrated
     * permission tables (per the package's own documented upgrade path —
     * the original create_permission_tables migration cannot be edited in
     * place once it has run). organization_id is added nullable everywhere,
     * even on the pivot tables where Spatie's own fresh-install migration
     * makes it NOT NULL: this table already has real assignment data with
     * no organization_id to backfill until the data-migration command runs,
     * so a NOT NULL constraint here would fail immediately. New rows written
     * once teams is live always get a real organization_id from
     * setPermissionsTeamId(); any pre-existing NULL rows are inert legacy
     * data, matching this rollout's "don't force a destructive backfill in
     * a migration" approach.
     */
    public function up(): void
    {
        // On the long-running dev database this migration runs against a
        // roles table created back when config('permission.teams') was
        // still false, so none of this exists yet. But create_permission_tables
        // reads that same config live, and on any fresh migrate (a new
        // environment, or RefreshDatabase in tests) teams is already true by
        // the time it runs — so it creates roles/model_has_roles/
        // model_has_permissions with team support (including a
        // (team, name, guard_name) unique constraint) itself. Every step
        // here is guarded so it's a no-op wherever the base migration
        // already did the work, and only fills the gap on the old database.
        if (! Schema::hasColumn('roles', 'organization_id')) {
            Schema::table('roles', function (Blueprint $table) {
                $table->unsignedBigInteger('organization_id')->nullable()->after('id');
                $table->index('organization_id', 'roles_organization_id_index');
            });

            // Replace the global (name, guard_name) uniqueness with
            // (organization_id, name, guard_name) — two organizations may
            // now both have a role literally named "Supervisor".
            Schema::table('roles', function (Blueprint $table) {
                $table->dropUnique(['name', 'guard_name']);
                $table->unique(['organization_id', 'name', 'guard_name'], 'roles_organization_name_guard_unique');
            });
        }

        if (! Schema::hasColumn('roles', 'key')) {
            Schema::table('roles', function (Blueprint $table) {
                $table->string('key')->nullable()->after('name');
            });
        }

        if (! Schema::hasColumn('roles', 'description')) {
            Schema::table('roles', function (Blueprint $table) {
                $table->text('description')->nullable()->after('key');
            });
        }

        if (! Schema::hasColumn('model_has_roles', 'organization_id')) {
            Schema::table('model_has_roles', function (Blueprint $table) {
                $table->unsignedBigInteger('organization_id')->nullable()->after('role_id');
                $table->index('organization_id', 'model_has_roles_organization_id_index');
            });
        }

        if (! Schema::hasColumn('model_has_permissions', 'organization_id')) {
            Schema::table('model_has_permissions', function (Blueprint $table) {
                $table->unsignedBigInteger('organization_id')->nullable()->after('permission_id');
                $table->index('organization_id', 'model_has_permissions_organization_id_index');
            });
        }

        if (! Schema::hasColumn('permissions', 'label')) {
            Schema::table('permissions', function (Blueprint $table) {
                $table->string('label')->nullable()->after('name');
                $table->text('description')->nullable()->after('label');
                $table->string('group')->nullable()->after('description');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('permissions', 'label')) {
            Schema::table('permissions', function (Blueprint $table) {
                $table->dropColumn(['label', 'description', 'group']);
            });
        }

        if (Schema::hasColumn('model_has_permissions', 'organization_id')) {
            Schema::table('model_has_permissions', function (Blueprint $table) {
                $table->dropIndex('model_has_permissions_organization_id_index');
                $table->dropColumn('organization_id');
            });
        }

        if (Schema::hasColumn('model_has_roles', 'organization_id')) {
            Schema::table('model_has_roles', function (Blueprint $table) {
                $table->dropIndex('model_has_roles_organization_id_index');
                $table->dropColumn('organization_id');
            });
        }

        if (Schema::hasColumn('roles', 'key')) {
            Schema::table('roles', function (Blueprint $table) {
                $table->dropColumn(['key', 'description']);
            });
        }

        if (Schema::hasColumn('roles', 'organization_id')) {
            Schema::table('roles', function (Blueprint $table) {
                $table->dropUnique('roles_organization_name_guard_unique');
                $table->unique(['name', 'guard_name']);
                $table->dropIndex('roles_organization_id_index');
                $table->dropColumn('organization_id');
            });
        }
    }
};
