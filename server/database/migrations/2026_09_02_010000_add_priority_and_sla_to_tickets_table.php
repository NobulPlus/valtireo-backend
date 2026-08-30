<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            $table->string('priority')->default('medium')->after('status')->index();
            $table->timestamp('sla_due_at')->nullable()->after('resolved_at')->index();
        });
    }

    public function down(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            $table->dropIndex('tickets_priority_index');
            $table->dropIndex('tickets_sla_due_at_index');
            $table->dropColumn(['priority', 'sla_due_at']);
        });
    }
};
