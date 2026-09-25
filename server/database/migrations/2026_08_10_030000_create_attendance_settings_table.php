<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attendance_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->string('timezone')->default('Africa/Lagos');
            $table->unsignedSmallInteger('late_grace_minutes')->default(15);
            $table->unsignedSmallInteger('early_checkout_grace_minutes')->default(10);
            $table->unsignedSmallInteger('rounding_minutes')->default(0);
            $table->boolean('allow_employee_clock_in')->default(true);
            $table->boolean('allow_employee_corrections')->default(true);
            $table->boolean('require_approval_for_corrections')->default(true);
            $table->json('allowed_sources')->nullable();
            $table->timestamps();

            $table->unique('organization_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attendance_settings');
    }
};
