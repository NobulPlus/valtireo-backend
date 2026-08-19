<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Mirrors employee_profile_activities' shape — same established pattern
     * for a curated, human-readable event trail, applied to role-management
     * events (role permission-set changes) that Spatie's pivot tables don't
     * get automatic before/after tracking for via the OwenIt audit trait.
     */
    public function up(): void
    {
        Schema::create('role_activities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('role_id')->nullable()->constrained('roles')->nullOnDelete();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('event')->index();
            $table->string('title');
            $table->text('description')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['organization_id', 'role_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('role_activities');
    }
};
