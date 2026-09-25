<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('asset_incidents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('asset_id')->constrained()->cascadeOnDelete();
            $table->foreignId('reported_by_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('ticket_id')->nullable()->constrained()->nullOnDelete();
            $table->string('event');
            $table->string('previous_status')->nullable();
            $table->string('new_status')->nullable();
            $table->text('note')->nullable();
            $table->timestamps();

            $table->index(['asset_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('asset_incidents');
    }
};
