<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('employee_custom_field_values')) {
            Schema::table('employee_custom_field_values', function (Blueprint $table) {
                $table->unique(['employee_id', 'employee_custom_field_id'], 'emp_custom_values_employee_field_unique');
                $table->index(['organization_id', 'employee_id'], 'emp_custom_values_org_employee_index');
            });

            return;
        }

        Schema::create('employee_custom_field_values', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_custom_field_id')->constrained()->cascadeOnDelete();
            $table->foreignId('updated_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('value')->nullable();
            $table->timestamps();

            $table->unique(['employee_id', 'employee_custom_field_id'], 'emp_custom_values_employee_field_unique');
            $table->index(['organization_id', 'employee_id'], 'emp_custom_values_org_employee_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employee_custom_field_values');
    }
};
