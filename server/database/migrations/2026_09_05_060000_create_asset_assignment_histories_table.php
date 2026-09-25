<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('asset_assignment_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('asset_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->foreignId('assigned_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('returned_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('assigned_at')->useCurrent();
            $table->timestamp('returned_at')->nullable()->index();
            $table->string('issue_condition')->nullable();
            $table->string('return_condition')->nullable();
            $table->text('issue_note')->nullable();
            $table->text('return_note')->nullable();
            $table->timestamps();

            $table->index(['organization_id', 'employee_id', 'returned_at'], 'asset_assignment_employee_return_idx');
            $table->index(['asset_id', 'returned_at'], 'asset_assignment_asset_return_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('asset_assignment_histories');
    }
};
