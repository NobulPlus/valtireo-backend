<?php

use App\Models\PlatformModule;
use Illuminate\Database\Migrations\Migration;

/**
 * Adds Orbit to the platform module catalog only — it does not subscribe
 * any organization to it. A module appearing in the catalog and an
 * organization being subscribed to it are two independent steps everywhere
 * in this app (see ModuleEntitlementService); this migration performs only
 * the first one.
 */
return new class extends Migration
{
    public function up(): void
    {
        PlatformModule::query()->updateOrCreate(
            ['key' => 'orbit'],
            [
                'name' => 'Orbit',
                'description' => 'Team and delivery work management — boards, tasks, and planned work.',
                'category' => 'work',
                'required_permission' => 'orbit.access',
                'is_active' => true,
                'sort_order' => 270,
            ]
        );
    }

    public function down(): void
    {
        PlatformModule::query()->where('key', 'orbit')->delete();
    }
};
