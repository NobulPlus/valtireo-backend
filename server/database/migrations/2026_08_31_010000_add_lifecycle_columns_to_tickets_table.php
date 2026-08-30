<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            $table->foreignId('assigned_to_user_id')->nullable()->after('requested_by_id')->constrained('users')->nullOnDelete();
            $table->timestamp('resolved_at')->nullable()->after('reviewed_at');
        });
    }

    public function down(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            $table->dropConstrainedForeignId('assigned_to_user_id');
            $table->dropColumn('resolved_at');
        });
    }
};
