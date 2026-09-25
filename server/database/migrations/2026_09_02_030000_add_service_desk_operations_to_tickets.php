<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            $table->timestamp('first_responded_at')->nullable()->after('reviewed_at')->index();
            $table->timestamp('on_hold_at')->nullable()->after('resolved_at');
            $table->text('hold_reason')->nullable()->after('on_hold_at');
            $table->unsignedTinyInteger('escalation_level')->default(0)->after('priority');
            $table->timestamp('escalated_at')->nullable()->after('escalation_level');
            $table->timestamp('closed_at')->nullable()->after('sla_due_at')->index();
            $table->unsignedTinyInteger('satisfaction_rating')->nullable()->after('closed_at');
            $table->text('satisfaction_comment')->nullable()->after('satisfaction_rating');
        });

        Schema::create('ticket_activities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('ticket_id')->constrained()->cascadeOnDelete();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('event');
            $table->string('previous_status')->nullable();
            $table->string('new_status')->nullable();
            $table->string('visibility')->default('public')->index();
            $table->text('note')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['organization_id', 'ticket_id']);
            $table->index(['organization_id', 'event']);
        });

        Schema::create('ticket_watchers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('ticket_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['ticket_id', 'user_id']);
            $table->index(['organization_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ticket_watchers');
        Schema::dropIfExists('ticket_activities');

        Schema::table('tickets', function (Blueprint $table) {
            $table->dropColumn([
                'first_responded_at',
                'on_hold_at',
                'hold_reason',
                'escalation_level',
                'escalated_at',
                'closed_at',
                'satisfaction_rating',
                'satisfaction_comment',
            ]);
        });
    }
};
