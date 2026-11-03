<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('orbit_workspaces', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('slug');
            $table->text('description')->nullable();
            $table->string('visibility')->default('organization');
            $table->foreignId('owner_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('archived_at')->nullable();
            $table->timestamps();

            $table->unique(['organization_id', 'slug'], 'orbit_workspaces_org_slug_uq');
        });

        Schema::create('orbit_workspace_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('workspace_id')->constrained('orbit_workspaces')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('role');
            $table->timestamps();

            $table->unique(['workspace_id', 'user_id'], 'orbit_workspace_members_uq');
        });

        Schema::create('orbit_projects', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('workspace_id')->constrained('orbit_workspaces')->cascadeOnDelete();
            $table->string('name');
            $table->string('key_prefix', 10);
            $table->text('description')->nullable();
            $table->string('mode')->default('kanban');
            $table->string('visibility')->default('organization');
            $table->unsignedInteger('next_item_number')->default(1);
            $table->timestamp('archived_at')->nullable();
            $table->timestamps();

            $table->unique(['organization_id', 'key_prefix'], 'orbit_projects_org_prefix_uq');
        });

        Schema::create('orbit_project_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('project_id')->constrained('orbit_projects')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('role');
            $table->timestamps();

            $table->unique(['project_id', 'user_id'], 'orbit_project_members_uq');
        });

        Schema::create('orbit_statuses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained('orbit_projects')->cascadeOnDelete();
            $table->string('name');
            $table->string('category')->default('todo');
            $table->unsignedInteger('position')->default(0);
            $table->boolean('is_default')->default(false);
            $table->timestamps();

            $table->index(['project_id', 'position'], 'orbit_statuses_project_position_idx');
        });

        Schema::create('orbit_iterations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained('orbit_projects')->cascadeOnDelete();
            $table->string('name');
            $table->text('goal')->nullable();
            $table->date('starts_at');
            $table->date('ends_at');
            $table->string('capacity_note')->nullable();
            $table->string('status')->default('planned');
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index(['project_id', 'status'], 'orbit_iterations_project_status_idx');
        });

        Schema::create('orbit_work_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('project_id')->constrained('orbit_projects')->cascadeOnDelete();
            $table->string('key');
            $table->string('type');
            $table->string('title');
            $table->text('description')->nullable();
            $table->json('story_template')->nullable();
            $table->text('acceptance_criteria')->nullable();
            $table->text('definition_of_done')->nullable();
            $table->foreignId('status_id')->constrained('orbit_statuses')->restrictOnDelete();
            $table->string('priority')->default('medium');
            $table->foreignId('reporter_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('assignee_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('parent_id')->nullable()->constrained('orbit_work_items')->nullOnDelete();
            $table->foreignId('epic_id')->nullable()->constrained('orbit_work_items')->nullOnDelete();
            $table->foreignId('iteration_id')->nullable()->constrained('orbit_iterations')->nullOnDelete();
            $table->decimal('estimate', 8, 2)->nullable();
            $table->decimal('remaining_estimate', 8, 2)->nullable();
            $table->date('due_at')->nullable();
            $table->date('start_at')->nullable();
            $table->decimal('position', 20, 10)->default(0);
            $table->unsignedInteger('version')->default(1);
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('archived_at')->nullable();
            $table->timestamps();

            $table->unique(['organization_id', 'key'], 'orbit_work_items_org_key_uq');
            $table->index(['project_id', 'status_id', 'position'], 'orbit_work_items_board_idx');
            $table->index(['project_id', 'iteration_id'], 'orbit_work_items_iteration_idx');
            $table->index(['assignee_id'], 'orbit_work_items_assignee_idx');
            $table->index(['epic_id'], 'orbit_work_items_epic_idx');
        });

        Schema::create('orbit_labels', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained('orbit_projects')->cascadeOnDelete();
            $table->string('name');
            $table->string('color');
            $table->timestamps();

            $table->unique(['project_id', 'name'], 'orbit_labels_project_name_uq');
        });

        Schema::create('orbit_work_item_labels', function (Blueprint $table) {
            $table->id();
            $table->foreignId('work_item_id')->constrained('orbit_work_items')->cascadeOnDelete();
            $table->foreignId('label_id')->constrained('orbit_labels')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['work_item_id', 'label_id'], 'orbit_work_item_labels_uq');
        });

        Schema::create('orbit_work_item_watchers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('work_item_id')->constrained('orbit_work_items')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['work_item_id', 'user_id'], 'orbit_work_item_watchers_uq');
        });

        Schema::create('orbit_comments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('work_item_id')->constrained('orbit_work_items')->cascadeOnDelete();
            $table->foreignId('author_id')->constrained('users')->restrictOnDelete();
            $table->text('body');
            $table->foreignId('reply_to_id')->nullable()->constrained('orbit_comments')->nullOnDelete();
            $table->json('mentions')->nullable();
            $table->timestamp('edited_at')->nullable();
            $table->softDeletes();
            $table->timestamps();

            $table->index(['work_item_id', 'created_at'], 'orbit_comments_work_item_idx');
        });

        Schema::create('orbit_attachments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('work_item_id')->nullable()->constrained('orbit_work_items')->cascadeOnDelete();
            $table->foreignId('comment_id')->nullable()->constrained('orbit_comments')->cascadeOnDelete();
            $table->foreignId('uploaded_by_id')->constrained('users')->restrictOnDelete();
            $table->string('file_name');
            $table->string('file_path');
            $table->string('mime_type');
            $table->unsignedInteger('file_size');
            $table->softDeletes();
            $table->timestamps();

            $table->index(['work_item_id'], 'orbit_attachments_work_item_idx');
            $table->index(['comment_id'], 'orbit_attachments_comment_idx');
        });

        Schema::create('orbit_work_item_activities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('work_item_id')->constrained('orbit_work_items')->cascadeOnDelete();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('event');
            $table->string('title');
            $table->json('from_value')->nullable();
            $table->json('to_value')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('created_at');

            $table->index(['work_item_id', 'created_at'], 'orbit_activities_work_item_idx');
        });

        Schema::create('orbit_work_item_links', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('work_item_id')->constrained('orbit_work_items')->cascadeOnDelete();
            $table->string('linked_type');
            $table->unsignedBigInteger('linked_id');
            $table->foreignId('created_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('created_at');

            $table->unique(['work_item_id', 'linked_type', 'linked_id'], 'orbit_work_item_links_uq');
            $table->index(['linked_type', 'linked_id'], 'orbit_work_item_links_reverse_idx');
        });

        Schema::create('orbit_iteration_carryovers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('from_iteration_id')->constrained('orbit_iterations')->cascadeOnDelete();
            $table->foreignId('to_iteration_id')->nullable()->constrained('orbit_iterations')->nullOnDelete();
            $table->foreignId('work_item_id')->constrained('orbit_work_items')->cascadeOnDelete();
            $table->foreignId('carried_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('orbit_iteration_carryovers');
        Schema::dropIfExists('orbit_work_item_links');
        Schema::dropIfExists('orbit_work_item_activities');
        Schema::dropIfExists('orbit_attachments');
        Schema::dropIfExists('orbit_comments');
        Schema::dropIfExists('orbit_work_item_watchers');
        Schema::dropIfExists('orbit_work_item_labels');
        Schema::dropIfExists('orbit_labels');
        Schema::dropIfExists('orbit_work_items');
        Schema::dropIfExists('orbit_iterations');
        Schema::dropIfExists('orbit_statuses');
        Schema::dropIfExists('orbit_project_members');
        Schema::dropIfExists('orbit_projects');
        Schema::dropIfExists('orbit_workspace_members');
        Schema::dropIfExists('orbit_workspaces');
    }
};
