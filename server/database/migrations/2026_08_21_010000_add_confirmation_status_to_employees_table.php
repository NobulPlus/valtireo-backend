<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->string('confirmation_status')->default('not_applicable')->index()->after('status');
        });

        // Employment status and confirmation status used to be one flat field.
        // Split existing 'probation'/'confirmed' rows into employment status
        // 'active' plus the matching confirmation status.
        DB::table('employees')
            ->whereIn('status', ['probation', 'confirmed'])
            ->update([
                'confirmation_status' => DB::raw('status'),
                'status' => 'active',
            ]);
    }

    public function down(): void
    {
        DB::table('employees')
            ->whereIn('confirmation_status', ['probation', 'confirmed'])
            ->update([
                'status' => DB::raw('confirmation_status'),
            ]);

        Schema::table('employees', function (Blueprint $table) {
            $table->dropColumn('confirmation_status');
        });
    }
};
