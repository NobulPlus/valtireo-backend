<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('assets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('asset_tag');
            $table->string('category')->index();
            $table->string('status')->default('available')->index();
            $table->foreignId('assigned_to_employee_id')->nullable()->constrained('employees')->nullOnDelete();
            $table->timestamp('assigned_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['organization_id', 'asset_tag']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('assets');
    }
};
