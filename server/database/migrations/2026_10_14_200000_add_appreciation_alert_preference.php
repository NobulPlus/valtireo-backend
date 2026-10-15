<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employee_lifestyle_preferences', function (Blueprint $table) {
            $table->boolean('appreciation_notifications')->default(false);
        });
    }

    public function down(): void
    {
        Schema::table('employee_lifestyle_preferences', fn (Blueprint $table) => $table->dropColumn('appreciation_notifications'));
    }
};
