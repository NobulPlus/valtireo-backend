<?php

use App\Models\Organization;
use App\Services\DefaultRoleSeedingService;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        Organization::query()->orderBy('id')->chunkById(100, function ($organizations): void {
            foreach ($organizations as $organization) {
                app(DefaultRoleSeedingService::class)->seedForOrganization($organization);
            }
        });
    }

    public function down(): void
    {
        // Roles may already have users or organization-specific changes.
        // Never remove customer access-control data during a rollback.
    }
};
