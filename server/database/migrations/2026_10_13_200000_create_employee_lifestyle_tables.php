<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employee_lifestyle_preferences', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->unique()->constrained()->cascadeOnDelete();
            $table->boolean('share_birthday')->default(false);
            $table->boolean('share_anniversary')->default(false);
            $table->boolean('receive_appreciation')->default(false);
            $table->boolean('allow_shared_appreciation')->default(false);
            $table->timestamps();
        });
        Schema::create('employee_appreciations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('sender_employee_id')->constrained('employees')->cascadeOnDelete();
            $table->foreignId('recipient_employee_id')->constrained('employees')->cascadeOnDelete();
            $table->text('message');
            $table->string('visibility', 20)->default('private');
            $table->timestamp('hidden_at')->nullable();
            $table->foreignId('hidden_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('moderation_reason', 500)->nullable();
            $table->timestamps();
            $table->index(['organization_id', 'visibility', 'created_at'], 'appreciations_feed_index');
        });
        Schema::create('employee_appreciation_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('appreciation_id')->constrained('employee_appreciations')->cascadeOnDelete();
            $table->foreignId('reporter_employee_id')->constrained('employees')->cascadeOnDelete();
            $table->string('reason', 500);
            $table->timestamps();
            $table->unique(['appreciation_id', 'reporter_employee_id'], 'appreciation_report_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employee_appreciation_reports');
        Schema::dropIfExists('employee_appreciations');
        Schema::dropIfExists('employee_lifestyle_preferences');
    }
};
