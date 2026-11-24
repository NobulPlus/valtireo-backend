<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orbit_attachments', function (Blueprint $table) {
            $table->boolean('is_deliverable')->default(false)->after('file_size');
        });
    }

    public function down(): void
    {
        Schema::table('orbit_attachments', function (Blueprint $table) {
            $table->dropColumn('is_deliverable');
        });
    }
};
