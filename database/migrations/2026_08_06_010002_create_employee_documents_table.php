<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employee_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->foreignId('document_type_id')->constrained()->cascadeOnDelete();
            $table->foreignId('document_requirement_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('uploaded_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('reviewed_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('title');
            $table->string('file_name');
            $table->string('file_path', 2048);
            $table->string('mime_type')->nullable();
            $table->unsignedBigInteger('file_size')->nullable();
            $table->date('issued_at')->nullable();
            $table->date('expires_at')->nullable()->index();
            $table->string('status')->default('submitted')->index();
            $table->text('notes')->nullable();
            $table->text('review_note')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();

            $table->index(['organization_id', 'employee_id', 'status']);
            $table->index(['organization_id', 'document_type_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employee_documents');
    }
};
