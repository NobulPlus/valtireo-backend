<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('operation_automation_runs', function (Blueprint $table) {
            $table->string('deduplication_key', 64)->nullable()->after('trigger');
            $table->unique(
                ['organization_id', 'operation_automation_rule_id', 'deduplication_key'],
                'op_runs_dedupe_uq'
            );
        });
    }

    public function down(): void
    {
        Schema::table('operation_automation_runs', function (Blueprint $table) {
            $table->dropUnique('op_runs_dedupe_uq');
            $table->dropColumn('deduplication_key');
        });
    }
};
