<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cluster_organization_location', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cluster_id')->constrained()->cascadeOnDelete();
            $table->foreignId('organization_location_id')->constrained()->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['cluster_id', 'organization_location_id'], 'cluster_location_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cluster_organization_location');
    }
};
