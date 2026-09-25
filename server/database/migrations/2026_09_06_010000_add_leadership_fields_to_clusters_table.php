<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('clusters', function (Blueprint $table) {
            $table->foreignId('manager_employee_id')
                ->nullable()
                ->after('department_id')
                ->constrained('employees')
                ->nullOnDelete();
            $table->foreignId('supervisor_employee_id')
                ->nullable()
                ->after('manager_employee_id')
                ->constrained('employees')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('clusters', function (Blueprint $table) {
            $table->dropConstrainedForeignId('supervisor_employee_id');
            $table->dropConstrainedForeignId('manager_employee_id');
        });
    }
};
