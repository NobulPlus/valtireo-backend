<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ticket_categories', function (Blueprint $table) {
            $table->unsignedSmallInteger('response_sla_hours')->nullable()->after('description');
            $table->unsignedSmallInteger('resolution_sla_hours')->nullable()->after('response_sla_hours');
        });
    }

    public function down(): void
    {
        Schema::table('ticket_categories', function (Blueprint $table) {
            $table->dropColumn(['response_sla_hours', 'resolution_sla_hours']);
        });
    }
};
