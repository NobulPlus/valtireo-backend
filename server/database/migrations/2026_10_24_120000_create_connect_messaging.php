<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('connect_conversations', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $t->foreignId('owner_id')->constrained('users');
            $t->string('kind', 16);
            $t->string('visibility', 16)->default('private');
            $t->string('name', 120)->nullable();
            $t->string('direct_key', 80)->nullable();
            $t->boolean('archived')->default(false);
            $t->timestamps();
            $t->unique(['organization_id', 'direct_key']);
            $t->index(['organization_id', 'updated_at']);
        });
        Schema::create('connect_members', function (Blueprint $t) {
            $t->id();
            $t->foreignUuid('conversation_id')->constrained('connect_conversations')->cascadeOnDelete();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->unsignedBigInteger('last_read_id')->default(0);
            $t->boolean('muted')->default(false);
            $t->timestamps();
            $t->unique(['conversation_id', 'user_id']);
        });
        Schema::create('connect_messages', function (Blueprint $t) {
            $t->id();
            $t->foreignUuid('conversation_id')->constrained('connect_conversations')->cascadeOnDelete();
            $t->foreignId('sender_id')->constrained('users');
            $t->uuid('client_id');
            $t->foreignId('reply_to_id')->nullable()->constrained('connect_messages');
            $t->text('body')->nullable();
            $t->string('file_path')->nullable();
            $t->string('file_name')->nullable();
            $t->string('file_mime', 120)->nullable();
            $t->unsignedBigInteger('file_size')->nullable();
            $t->boolean('voice_note')->default(false);
            $t->boolean('pinned')->default(false);
            $t->json('mentions')->nullable();
            $t->timestamp('edited_at')->nullable();
            $t->timestamp('deleted_at')->nullable();
            $t->timestamps();
            $t->unique(['conversation_id', 'sender_id', 'client_id'], 'connect_message_retry_unique');
            $t->index(['conversation_id', 'id']);
        });
        Schema::create('connect_reactions', function (Blueprint $t) {
            $t->id();
            $t->foreignId('message_id')->constrained('connect_messages')->cascadeOnDelete();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->string('reaction', 24);
            $t->unique(['message_id', 'user_id', 'reaction']);
        });
        Schema::create('connect_reports', function (Blueprint $t) {
            $t->id();
            $t->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $t->foreignId('message_id')->constrained('connect_messages')->cascadeOnDelete();
            $t->foreignId('reporter_id')->constrained('users');
            $t->string('reason', 1000);
            $t->string('status', 16)->default('open');
            $t->foreignId('reviewer_id')->nullable()->constrained('users');
            $t->string('resolution', 1000)->nullable();
            $t->timestamps();
            $t->unique(['message_id', 'reporter_id']);
        });
        Schema::create('connect_preferences', function (Blueprint $t) {
            $t->foreignId('user_id')->primary()->constrained()->cascadeOnDelete();
            $t->string('availability', 16)->default('available');
            $t->boolean('notifications')->default(true);
            $t->boolean('allow_calls')->default(true);
            $t->timestamps();
        });
        Schema::create('connect_voice_calls', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $t->foreignUuid('conversation_id')->constrained('connect_conversations')->cascadeOnDelete();
            $t->foreignId('caller_id')->constrained('users');
            $t->foreignId('callee_id')->constrained('users');
            $t->string('status', 16)->default('ringing');
            $t->timestamp('expires_at');
            $t->timestamp('accepted_at')->nullable();
            $t->timestamp('ended_at')->nullable();
            $t->timestamp('room_closed_at')->nullable();
            $t->timestamps();
            $t->index(['organization_id', 'status']);
        });
        Schema::create('connect_audit_events', function (Blueprint $t) {
            $t->id();
            $t->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $t->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $t->string('action', 80);
            $t->string('subject_id', 80);
            $t->json('metadata')->nullable();
            $t->timestamp('created_at');
        });
    }

    public function down(): void
    {
        foreach (['connect_audit_events', 'connect_voice_calls', 'connect_preferences', 'connect_reports', 'connect_reactions', 'connect_messages', 'connect_members', 'connect_conversations'] as $table) Schema::dropIfExists($table);
    }
};
