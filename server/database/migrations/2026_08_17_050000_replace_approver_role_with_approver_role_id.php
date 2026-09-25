<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * `approver_role` was a free-text string (validated only as
     * nullable|string|max:255, no existence check against actual roles) —
     * confirmed zero current usage, tests, or UI configuring it. Replacing
     * it with a proper FK is free to do correctly now rather than defer,
     * and removes another bare-string role-name dependency before
     * organization-owned renameable roles ship.
     */
    public function up(): void
    {
        Schema::table('approval_workflow_steps', function (Blueprint $table) {
            $table->dropColumn('approver_role');
        });

        Schema::table('approval_workflow_steps', function (Blueprint $table) {
            $table->foreignId('approver_role_id')->nullable()->after('approver_type')->constrained('roles')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('approval_workflow_steps', function (Blueprint $table) {
            $table->dropConstrainedForeignId('approver_role_id');
        });

        Schema::table('approval_workflow_steps', function (Blueprint $table) {
            $table->string('approver_role')->nullable();
        });
    }
};
