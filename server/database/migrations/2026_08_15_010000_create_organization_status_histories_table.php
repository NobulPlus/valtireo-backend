<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('organization_status_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('changed_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('previous_status')->nullable();
            $table->string('new_status')->index();
            $table->text('reason')->nullable();
            $table->timestamps();

            $table->index(['organization_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('organization_status_histories');
    }
};
