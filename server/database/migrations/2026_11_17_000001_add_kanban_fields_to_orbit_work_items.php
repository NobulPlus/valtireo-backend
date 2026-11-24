<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orbit_work_items', function (Blueprint $table) {
            $table->boolean('is_blocked')->default(false)->after('archived_at');
            $table->text('blocked_reason')->nullable()->after('is_blocked');
            $table->dateTime('status_changed_at')->nullable()->after('blocked_reason');
        });
    }

    public function down(): void
    {
        Schema::table('orbit_work_items', function (Blueprint $table) {
            $table->dropColumn(['is_blocked', 'blocked_reason', 'status_changed_at']);
        });
    }
};
