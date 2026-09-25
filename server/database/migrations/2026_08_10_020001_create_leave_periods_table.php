<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('leave_periods', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->date('starts_on');
            $table->date('ends_on');
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();

            $table->index(['organization_id', 'starts_on', 'ends_on'], 'leave_periods_org_dates_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('leave_periods');
    }
};
