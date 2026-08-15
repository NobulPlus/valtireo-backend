<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employee_document_reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_document_id')->constrained()->cascadeOnDelete();
            $table->foreignId('reviewed_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action');
            $table->string('previous_status')->nullable();
            $table->string('next_status');
            $table->text('note')->nullable();
            $table->timestamps();

            $table->index(['employee_document_id', 'action']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employee_document_reviews');
    }
};
