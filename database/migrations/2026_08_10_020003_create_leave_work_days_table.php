<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('leave_work_days', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('day_of_week');
            $table->boolean('is_working_day')->default(true);
            $table->timestamps();

            $table->unique(['organization_id', 'day_of_week'], 'leave_work_days_org_day_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('leave_work_days');
    }
};
