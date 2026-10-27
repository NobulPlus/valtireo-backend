<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('device_push_tokens', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->string('token', 255)->unique();
            $t->string('platform', 16);
            $t->timestamps();
            $t->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('device_push_tokens');
    }
};
