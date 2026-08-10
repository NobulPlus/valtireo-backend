<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('approval_workflow_steps', function (Blueprint $table) {
            $table->id();
            $table->foreignId('approval_workflow_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('step_order')->default(1);
            $table->string('name');
            $table->string('approver_type')->default('permission');
            $table->string('approver_role')->nullable();
            $table->string('approver_permission')->nullable();
            $table->boolean('note_required')->default(false);
            $table->boolean('is_active')->default(true)->index();
            $table->json('settings')->nullable();
            $table->timestamps();

            $table->unique(['approval_workflow_id', 'step_order'], 'approval_steps_workflow_order_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('approval_workflow_steps');
    }
};
