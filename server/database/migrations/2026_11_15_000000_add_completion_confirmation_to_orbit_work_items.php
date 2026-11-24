<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orbit_work_items', function (Blueprint $table) {
            $table->foreignId('completed_by_id')->nullable()->after('completed_at')->constrained('users')->nullOnDelete();
            $table->text('completion_note')->nullable()->after('completed_by_id');
        });
    }

    public function down(): void
    {
        Schema::table('orbit_work_items', function (Blueprint $table) {
            $table->dropConstrainedForeignId('completed_by_id');
            $table->dropColumn('completion_note');
        });
    }
};
