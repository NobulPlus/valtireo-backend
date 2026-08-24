<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employee_status_histories', function (Blueprint $table) {
            $table->string('previous_confirmation_status')->nullable()->after('new_status');
            $table->string('new_confirmation_status')->nullable()->after('previous_confirmation_status');
        });
    }

    public function down(): void
    {
        Schema::table('employee_status_histories', function (Blueprint $table) {
            $table->dropColumn(['previous_confirmation_status', 'new_confirmation_status']);
        });
    }
};
