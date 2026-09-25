<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // MySQL does not roll back DDL when a later statement in a migration
        // fails. Clear only this unrecorded migration's possible partial state
        // so a corrected retry can complete cleanly.
        Schema::dropIfExists('operation_automation_runs');
        Schema::dropIfExists('operation_automation_rules');
        Schema::dropIfExists('operation_tasks');

        Schema::create('operation_tasks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->string('key')->nullable();
            $table->nullableMorphs('source');
            $table->foreignId('subject_employee_id')->nullable()->constrained('employees')->nullOnDelete();
            $table->foreignId('assigned_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('created_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('completed_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('category')->default('general');
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('priority')->default('normal');
            $table->string('status')->default('open');
            $table->timestamp('due_at')->nullable();
            $table->string('action_url')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
            $table->unique(['organization_id', 'key'], 'op_tasks_org_key_uq');
            $table->index(['organization_id', 'status', 'priority', 'due_at'], 'op_tasks_queue_idx');
            $table->index(['organization_id', 'assigned_user_id', 'status'], 'op_tasks_assignee_idx');
        });

        Schema::create('operation_automation_rules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('trigger');
            $table->json('conditions')->nullable();
            $table->json('actions');
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('execution_order')->default(100);
            $table->foreignId('created_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['organization_id', 'trigger', 'is_active'], 'op_rules_trigger_idx');
        });

        Schema::create('operation_automation_runs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('operation_automation_rule_id')->constrained()->cascadeOnDelete();
            $table->nullableMorphs('subject');
            $table->string('trigger');
            $table->string('status');
            $table->json('context')->nullable();
            $table->json('results')->nullable();
            $table->text('error')->nullable();
            $table->timestamp('started_at');
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
            $table->index(['organization_id', 'status', 'created_at'], 'op_runs_status_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('operation_automation_runs');
        Schema::dropIfExists('operation_automation_rules');
        Schema::dropIfExists('operation_tasks');
    }
};
