<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Replaces the plain-string `system_role` column with a proper FK
     * reference to `roles`. Confirmed by full audit that `system_role` is
     * never read for a live authorization decision — only as a staging
     * value until a role is actually applied to a User, plus admin-UI
     * display — so there's no runtime-auth risk in swapping it, and no real
     * customer data exists yet for this very recently added column. A bare
     * string could silently go stale the moment an organization renames the
     * role it refers to; an FK can't.
     */
    public function up(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->dropColumn('system_role');
        });

        Schema::table('employees', function (Blueprint $table) {
            $table->foreignId('pending_role_id')->nullable()->after('status')->constrained('roles')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->dropConstrainedForeignId('pending_role_id');
        });

        Schema::table('employees', function (Blueprint $table) {
            $table->string('system_role')->nullable()->after('status');
        });
    }
};
