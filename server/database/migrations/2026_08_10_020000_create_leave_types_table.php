<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('leave_types', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('code');
            $table->text('description')->nullable();
            $table->boolean('is_paid')->default(true);
            $table->boolean('requires_attachment')->default(false);
            $table->unsignedSmallInteger('minimum_notice_days')->default(0);
            $table->unsignedSmallInteger('maximum_days_per_request')->nullable();
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();

            $table->unique(['organization_id', 'code']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('leave_types');
    }
};
