<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('leave_entitlements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->foreignId('leave_type_id')->constrained()->cascadeOnDelete();
            $table->foreignId('leave_period_id')->constrained()->cascadeOnDelete();
            $table->decimal('days_allocated', 8, 2)->default(0);
            $table->decimal('days_used', 8, 2)->default(0);
            $table->decimal('days_pending', 8, 2)->default(0);
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['employee_id', 'leave_type_id', 'leave_period_id'], 'leave_entitlements_employee_type_period_unique');
            $table->index(['organization_id', 'employee_id'], 'leave_entitlements_org_employee_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('leave_entitlements');
    }
};
