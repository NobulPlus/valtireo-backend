<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tickets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->foreignId('requested_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('category')->index();
            $table->string('subject');
            $table->text('description');
            $table->string('status')->default('submitted')->index();
            $table->string('attachment_file_name')->nullable();
            $table->string('attachment_file_path')->nullable();
            $table->string('attachment_mime_type')->nullable();
            $table->unsignedBigInteger('attachment_file_size')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();

            $table->index(['organization_id', 'employee_id', 'status'], 'tickets_org_employee_status_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tickets');
    }
};
