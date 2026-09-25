<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_types', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('code');
            $table->text('description')->nullable();
            $table->boolean('requires_expiry_date')->default(false);
            $table->unsignedSmallInteger('default_reminder_days')->default(30);
            $table->boolean('employee_upload_allowed')->default(true);
            $table->boolean('approval_required')->default(true);
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();

            $table->unique(['organization_id', 'code']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_types');
    }
};
