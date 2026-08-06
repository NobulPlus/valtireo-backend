<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_requirements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('document_type_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->text('description')->nullable();
            $table->boolean('is_required')->default(true)->index();
            $table->boolean('employee_upload_allowed')->default(true);
            $table->boolean('approval_required')->default(true);
            $table->unsignedSmallInteger('reminder_days')->default(30);
            $table->foreignId('department_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('designation_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('grade_level_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('employment_type_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('organization_location_id')->nullable()->constrained()->nullOnDelete();
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();

            $table->index(['organization_id', 'document_type_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_requirements');
    }
};
