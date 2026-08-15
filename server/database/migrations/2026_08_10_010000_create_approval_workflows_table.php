<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('approval_workflows', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->string('module');
            $table->string('action');
            $table->string('name');
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true)->index();
            $table->boolean('require_note_on_reject')->default(true);
            $table->boolean('require_note_on_request_changes')->default(true);
            $table->boolean('auto_approve_when_no_steps')->default(false);
            $table->json('conditions')->nullable();
            $table->timestamps();

            $table->index(['organization_id', 'module', 'action'], 'approval_workflows_org_module_action_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('approval_workflows');
    }
};
