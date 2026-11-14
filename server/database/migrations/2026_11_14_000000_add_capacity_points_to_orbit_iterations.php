<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * capacity_points is a numeric companion to the existing free-text
 * capacity_note — sprint planning needs a number to compare committed
 * estimate totals against, not just a note.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orbit_iterations', function (Blueprint $table) {
            $table->decimal('capacity_points', 8, 2)->nullable()->after('capacity_note');
        });
    }

    public function down(): void
    {
        Schema::table('orbit_iterations', function (Blueprint $table) {
            $table->dropColumn('capacity_points');
        });
    }
};
