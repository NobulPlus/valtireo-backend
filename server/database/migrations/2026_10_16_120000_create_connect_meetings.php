<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('connect_meetings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('host_user_id')->constrained('users')->restrictOnDelete();
            $table->string('title', 160);
            $table->text('description')->nullable();
            $table->string('status', 20)->default('scheduled');
            $table->timestamp('starts_at');
            $table->timestamp('ends_at');
            $table->timestamp('started_at')->nullable();
            $table->timestamp('ended_at')->nullable();
            $table->timestamp('room_closed_at')->nullable();
            $table->timestamps();
            $table->index(['organization_id', 'starts_at']);
        });
        Schema::create('connect_meeting_members', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('meeting_id')->constrained('connect_meetings')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamp('last_join_requested_at')->nullable();
            $table->timestamps();
            $table->unique(['meeting_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('connect_meeting_members');
        Schema::dropIfExists('connect_meetings');
    }
};
