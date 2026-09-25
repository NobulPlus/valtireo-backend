<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('system_error_logs', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('organization_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('resolved_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('level')->default('error')->index();
            $table->unsignedSmallInteger('status_code')->nullable()->index();
            $table->string('exception_class');
            $table->text('message');
            $table->string('file')->nullable();
            $table->unsignedInteger('line')->nullable();
            $table->string('method', 16)->nullable();
            $table->string('url')->nullable();
            $table->string('route')->nullable();
            $table->string('ip_address', 64)->nullable();
            $table->text('user_agent')->nullable();
            $table->string('request_id')->nullable()->index();
            $table->string('fingerprint')->index();
            $table->json('context')->nullable();
            $table->json('trace_excerpt')->nullable();
            $table->timestamp('resolved_at')->nullable()->index();
            $table->text('resolution_note')->nullable();
            $table->timestamps();

            $table->index(['resolved_at', 'level']);
            $table->index(['organization_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('system_error_logs');
    }
};
